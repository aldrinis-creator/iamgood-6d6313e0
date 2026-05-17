// Email queue health check — runs every 15 minutes via pg_cron.
// Evaluates pipeline thresholds and emits in-app + email alerts to all admins.
import { createClient } from 'npm:@supabase/supabase-js@2'

type Severity = 'info' | 'warning' | 'critical'

interface Alert {
  type: string
  severity: Severity
  summary: string
  detail?: string
  metadata: Record<string, unknown>
  metadataLines?: string[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Load config
  const { data: config } = await supabase
    .from('email_alert_config')
    .select('*')
    .single()

  if (!config || !config.enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Pull queue stats
  const { data: queueStats } = await supabase.rpc('email_queue_stats')
  const stats: Record<string, { depth: number; oldest_age_seconds: number }> = {}
  for (const row of queueStats ?? []) {
    stats[row.queue_name] = {
      depth: Number(row.depth),
      oldest_age_seconds: Number(row.oldest_age_seconds),
    }
  }

  // Pull send state
  const { data: sendState } = await supabase
    .from('email_send_state')
    .select('retry_after_until')
    .single()

  const alerts: Alert[] = []
  const now = Date.now()

  // 1. DLQ total threshold
  const totalDlq =
    (stats['auth_emails_dlq']?.depth ?? 0) +
    (stats['transactional_emails_dlq']?.depth ?? 0)
  if (totalDlq >= config.dlq_total_threshold) {
    alerts.push({
      type: 'dlq_total_threshold',
      severity: 'critical',
      summary: `Dead-letter queue has ${totalDlq} messages (threshold ${config.dlq_total_threshold}).`,
      detail:
        'Messages in the DLQ were not delivered after retries. Inspect and requeue from the Admin → Emails dashboard.',
      metadata: { totalDlq, ...stats },
      metadataLines: [
        `auth_emails_dlq depth: ${stats['auth_emails_dlq']?.depth ?? 0}`,
        `transactional_emails_dlq depth: ${stats['transactional_emails_dlq']?.depth ?? 0}`,
      ],
    })
  }

  // 2. DLQ growth
  const { data: lastDlqAlert } = await supabase
    .from('email_alert_log')
    .select('metadata, created_at')
    .eq('alert_type', 'dlq_snapshot')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevTotal = Number((lastDlqAlert?.metadata as any)?.totalDlq ?? totalDlq)
  const growth = totalDlq - prevTotal
  if (growth >= config.dlq_growth_threshold) {
    alerts.push({
      type: 'dlq_growth',
      severity: 'critical',
      summary: `Dead-letter queue grew by ${growth} messages since last check.`,
      detail: 'A burst of permanent failures is occurring. Check provider status and recent logs.',
      metadata: { growth, totalDlq, prevTotal },
      metadataLines: [
        `Previous total: ${prevTotal}`,
        `Current total: ${totalDlq}`,
        `Delta: +${growth}`,
      ],
    })
  }

  // Always log a DLQ snapshot so growth can be tracked next cycle
  await supabase.from('email_alert_log').insert({
    alert_type: 'dlq_snapshot',
    severity: 'info',
    message: `Snapshot: DLQ=${totalDlq}, auth=${stats['auth_emails']?.depth ?? 0}, txn=${stats['transactional_emails']?.depth ?? 0}`,
    metadata: { totalDlq, stats },
  })

  // 3. Stuck queue (oldest message older than threshold)
  const stuckMinutes = config.stuck_queue_minutes
  for (const q of ['auth_emails', 'transactional_emails']) {
    const ageSec = stats[q]?.oldest_age_seconds ?? 0
    const depth = stats[q]?.depth ?? 0
    if (depth > 0 && ageSec > stuckMinutes * 60) {
      alerts.push({
        type: `stuck_queue_${q}`,
        severity: 'critical',
        summary: `${q} queue has messages older than ${stuckMinutes} minutes.`,
        detail:
          'The dispatcher may not be running or is blocked. Check the cron job and recent provider responses.',
        metadata: { queue: q, depth, oldestAgeSeconds: ageSec },
        metadataLines: [
          `Queue: ${q}`,
          `Depth: ${depth}`,
          `Oldest message age: ${Math.round(ageSec / 60)} min`,
        ],
      })
    }
  }

  // 4. No sends in last N minutes while pending messages exist
  const noSendWindowMs = config.no_send_window_minutes * 60 * 1000
  const sinceIso = new Date(now - noSendWindowMs).toISOString()
  const { count: recentSentCount } = await supabase
    .from('email_send_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', sinceIso)

  const pendingDepth =
    (stats['auth_emails']?.depth ?? 0) + (stats['transactional_emails']?.depth ?? 0)

  if ((recentSentCount ?? 0) === 0 && pendingDepth > 0) {
    alerts.push({
      type: 'dispatcher_stalled',
      severity: 'critical',
      summary: `No successful sends in last ${config.no_send_window_minutes} minutes while ${pendingDepth} messages are queued.`,
      detail:
        'The dispatcher cron may be broken or the service-role key was rotated. Re-run email infrastructure setup.',
      metadata: { recentSentCount: recentSentCount ?? 0, pendingDepth },
      metadataLines: [
        `Pending depth: ${pendingDepth}`,
        `Sends in window: 0`,
        `Window: ${config.no_send_window_minutes} min`,
      ],
    })
  }

  // 5. Bounce + complaint rates (last 1h)
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString()
  const { data: hourLogs } = await supabase
    .from('email_send_log')
    .select('status, message_id')
    .gte('created_at', oneHourAgo)

  const uniqueByMsg = new Map<string, string>()
  for (const row of hourLogs ?? []) {
    const id = (row as any).message_id
    if (!id) continue
    // Most recent wins: keep last status
    uniqueByMsg.set(id, (row as any).status)
  }
  const totalHour = uniqueByMsg.size
  let bounced = 0
  let complained = 0
  for (const status of uniqueByMsg.values()) {
    if (status === 'bounced') bounced++
    if (status === 'complained') complained++
  }
  if (totalHour >= 20) {
    const bounceRate = (bounced / totalHour) * 100
    if (bounceRate > Number(config.bounce_rate_threshold)) {
      alerts.push({
        type: 'high_bounce_rate',
        severity: 'warning',
        summary: `Bounce rate ${bounceRate.toFixed(2)}% over last hour (threshold ${config.bounce_rate_threshold}%).`,
        detail: 'High bounce rates damage sender reputation. Verify recipient lists and DNS records.',
        metadata: { bounced, totalHour, bounceRate },
        metadataLines: [
          `Bounced: ${bounced}`,
          `Total in window: ${totalHour}`,
          `Rate: ${bounceRate.toFixed(2)}%`,
        ],
      })
    }
  }

  // Complaint rate over last 24h
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const { data: dayLogs } = await supabase
    .from('email_send_log')
    .select('status, message_id')
    .gte('created_at', oneDayAgo)
  const uniqueDay = new Map<string, string>()
  for (const row of dayLogs ?? []) {
    const id = (row as any).message_id
    if (!id) continue
    uniqueDay.set(id, (row as any).status)
  }
  const totalDay = uniqueDay.size
  let complainedDay = 0
  for (const status of uniqueDay.values()) if (status === 'complained') complainedDay++
  if (totalDay >= 100) {
    const cr = (complainedDay / totalDay) * 100
    if (cr > Number(config.complaint_rate_threshold)) {
      alerts.push({
        type: 'high_complaint_rate',
        severity: 'critical',
        summary: `Complaint rate ${cr.toFixed(3)}% in last 24h (threshold ${config.complaint_rate_threshold}%).`,
        detail: 'Complaints above 0.1% can trigger sender blacklisting. Review email content and audience.',
        metadata: { complained: complainedDay, totalDay, complaintRate: cr },
        metadataLines: [
          `Complaints: ${complainedDay}`,
          `Total in window: ${totalDay}`,
          `Rate: ${cr.toFixed(3)}%`,
        ],
      })
    }
  }

  // 6. Long rate-limit cooldown
  if (sendState?.retry_after_until) {
    const cooldownRemainingMs = new Date(sendState.retry_after_until).getTime() - now
    if (cooldownRemainingMs > config.rate_limit_alert_minutes * 60 * 1000) {
      alerts.push({
        type: 'long_rate_limit_cooldown',
        severity: 'warning',
        summary: `Rate-limit cooldown active for ${Math.round(cooldownRemainingMs / 60000)} more minutes.`,
        detail: 'Provider is throttling sends. Pending emails will be delayed until cooldown expires.',
        metadata: { retryAfterUntil: sendState.retry_after_until },
        metadataLines: [`Cooldown ends: ${sendState.retry_after_until}`],
      })
    }
  }

  // Dispatch alerts with cooldown deduplication
  const cooldownMinutes = config.cooldown_minutes
  const cutoffIso = new Date(now - cooldownMinutes * 60 * 1000).toISOString()
  const dispatched: string[] = []
  const skipped: string[] = []

  // Admin recipients
  const { data: adminRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')

  const adminUserIds = (adminRoles ?? []).map((r: any) => r.user_id as string)
  const adminEmails: string[] = []
  if (adminUserIds.length > 0) {
    for (const uid of adminUserIds) {
      try {
        const { data } = await supabase.auth.admin.getUserById(uid)
        if (data?.user?.email) adminEmails.push(data.user.email)
      } catch (_) { /* ignore */ }
    }
  }
  const extraEmails = (config.extra_notification_emails || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
  const allEmails = Array.from(new Set([...adminEmails, ...extraEmails]))

  for (const alert of alerts) {
    // Cooldown check
    const { data: recent } = await supabase
      .from('email_alert_log')
      .select('id')
      .eq('alert_type', alert.type)
      .gte('created_at', cutoffIso)
      .limit(1)

    if (recent && recent.length > 0) {
      skipped.push(alert.type)
      continue
    }

    // Log alert
    await supabase.from('email_alert_log').insert({
      alert_type: alert.type,
      severity: alert.severity,
      message: alert.summary,
      metadata: alert.metadata,
    })

    // In-app notifications for each admin
    if (adminUserIds.length > 0) {
      await supabase.rpc('insert_notifications_deduped', {
        p_notifications: adminUserIds.map((uid) => ({
          user_id: uid,
          title: `Email alert: ${alert.type}`,
          message: alert.summary,
          type: 'email_health_alert',
        })),
      })
    }

    // Email each admin
    for (const email of allEmails) {
      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'email-health-alert',
            recipientEmail: email,
            idempotencyKey: `email-alert-${alert.type}-${Math.floor(now / (cooldownMinutes * 60 * 1000))}`,
            templateData: {
              alertType: alert.type,
              severity: alert.severity,
              summary: alert.summary,
              detail: alert.detail,
              metadataLines: alert.metadataLines ?? [],
            },
          },
        })
      } catch (e) {
        console.error('Failed to send health alert email', { email, error: e })
      }
    }

    dispatched.push(alert.type)
  }

  return new Response(
    JSON.stringify({
      checked_at: new Date().toISOString(),
      stats,
      alerts_total: alerts.length,
      dispatched,
      skipped,
      admin_recipients: allEmails.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
