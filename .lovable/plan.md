## Email Queue Monitoring & Automated Alerts

Build an admin-only monitoring dashboard plus a scheduled health-check job that proactively alerts admins when the email pipeline degrades.

### 1. Admin Email Monitoring Dashboard

New route `/admin/emails` (gated by existing `AdminRoute` + `has_role(admin)`).

**Stat cards (last 24h / 7d / 30d toggle):**
- Total unique emails (deduped by `message_id`)
- Sent / Failed / DLQ / Suppressed counts
- Bounce + complaint rate (%)
- Current queue depth (`auth_emails`, `transactional_emails`)
- DLQ depth (`auth_emails_dlq`, `transactional_emails_dlq`)
- Rate-limit cooldown status (from `email_send_state.retry_after_until`)
- Last successful cron run timestamp

**Charts:**
- Line chart: sends/failures per hour over selected range
- Breakdown by `template_name`

**Tables (paginated, 50/page):**
- Recent sends — filterable by template, status, recipient search, date range
- DLQ contents — viewable payload, recipient, failure reason, with a "Requeue" action that moves a message back to its source queue
- Suppressed addresses — with reason and ability to remove a suppression

All queries deduplicate on `message_id` using `DISTINCT ON`.

### 2. Health-Check Edge Function (`email-queue-health-check`)

Runs every 15 minutes via `pg_cron`. Evaluates thresholds and inserts admin notifications + sends a transactional alert email when any trigger.

**Alert triggers (configurable thresholds stored in `email_alert_config` table):**
- DLQ depth grew by ≥ N messages since last check (default N=5)
- Total DLQ depth exceeds threshold (default 20)
- Queue depth stuck: any message older than 10 minutes still unsent
- No successful sends in last 30 min while pending messages exist (likely cron/auth broken)
- Bounce rate > 5% over last 1h (min 20 sends)
- Complaint rate > 0.1% over last 24h
- `retry_after_until` rate-limit cooldown active > 30 min

**Deduplication:** Each alert type writes to a new `email_alert_log` table with a cooldown window (e.g. don't re-fire same alert within 2h) so admins aren't spammed.

**Recipients:** Send to all users with `admin` role (lookup `user_roles` + `profiles.email`/`auth.users.email`).

### 3. In-App Admin Notifications

Health-check inserts into existing `notifications` table for each admin user (type `email_health_alert`). The admin dashboard surfaces an unread badge.

### 4. Database changes (migration)

- `email_alert_config` — single-row config table: thresholds, cooldown minutes, enabled flag, comma-separated extra recipient emails
- `email_alert_log` — id, alert_type, severity, message, metadata jsonb, created_at; RLS admin-read-only
- RPC `email_queue_stats()` SECURITY DEFINER — returns queue depth per queue (reads `pgmq.q_<name>` tables which aren't directly exposed)
- RPC `requeue_dlq_message(dlq_name, msg_id)` SECURITY DEFINER, admin-only
- RLS: admin-only on all new tables
- `pg_cron` job calling `email-queue-health-check` every 15 min (uses vault `email_queue_service_role_key`)

### 5. Transactional alert email template

New template `email-health-alert.tsx` (Check-iN navy branding, per email branding memory). Scaffolded via existing `send-transactional-email` flow.

### Technical notes
- Reuse existing `process-email-queue` infrastructure — no changes to it
- Reuse existing pgmq RPC pattern (`SECURITY DEFINER` wrappers) for the new queue-stats and requeue RPCs
- Charts via `recharts` (already in project)
- All time displays in IST per project standards
- Admin route protection via existing `AdminRoute` component
- No new external services or secrets required

### Out of scope
- SMS/WhatsApp alerts (email only for v1)
- Auto-remediation (e.g. auto-purge DLQ) — admin must act manually via Requeue button
- Per-template SLA tracking

### Estimated work
~4–6 hours: dashboard (2h), health-check function + cron (1.5h), migration + RPCs (1h), alert template + wiring (0.5h), testing (1h).