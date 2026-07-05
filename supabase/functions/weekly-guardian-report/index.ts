import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "npm:@supabase/supabase-js@2";
import { WeeklyReportEmail } from "../_shared/transactional-email-templates/weekly-guardian-report.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDER_DOMAIN = "notify.futurewave.in";
const FROM_DOMAIN = "futurewave.in";
const SITE_NAME = "Check-iN";

// ── IST helpers ────────────────────────────────────────────────────────────
function nowIST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function weekRangeIST(): { weekStart: Date; weekEnd: Date; label: string } {
  const now = nowIST();
  // Sunday = 0; we want Mon–Sun
  const dayOfWeek = now.getDay(); // 0=Sun
  const diffToLastMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToLastMon - 7); // previous Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // previous Sunday
  weekEnd.setHours(23, 59, 59, 999);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
  const label = `${fmt(weekStart)} – ${fmt(weekEnd)}`;
  return { weekStart, weekEnd, label };
}

// ── Stat builder ───────────────────────────────────────────────────────────
async function buildWardStats(supabase: any, userId: string, weekStart: Date, weekEnd: Date) {
  const startISO = weekStart.toISOString();
  const endISO = weekEnd.toISOString();

  // Check-ins
  const { data: checkIns } = await supabase
    .from("check_ins")
    .select("status, scheduled_at, responded_at")
    .eq("user_id", userId)
    .gte("scheduled_at", startISO)
    .lte("scheduled_at", endISO);

  const totalCheckIns = checkIns?.length ?? 0;
  const respondedCheckIns = checkIns?.filter((c: any) => c.status === "responded").length ?? 0;
  const missedCheckIns = checkIns?.filter((c: any) => c.status === "missed").length ?? 0;

  // Medications
  const { data: medLogs } = await supabase
    .from("medication_logs")
    .select("status, scheduled_at, medication_id")
    .eq("user_id", userId)
    .gte("scheduled_at", startISO)
    .lte("scheduled_at", endISO);

  const totalMeds = medLogs?.length ?? 0;
  const takenMeds = medLogs?.filter((m: any) => m.status === "taken" || m.status === "taken_late").length ?? 0;
  const missedMeds = medLogs?.filter((m: any) => m.status === "missed").length ?? 0;
  const lateMeds = medLogs?.filter((m: any) => m.status === "taken_late").length ?? 0;

  // SOS events
  const { data: sosEvents } = await supabase
    .from("sos_events")
    .select("triggered_at, resolved_at, trigger_type")
    .eq("user_id", userId)
    .gte("triggered_at", startISO)
    .lte("triggered_at", endISO);

  const totalSOS = sosEvents?.length ?? 0;

  // Wellness / vitals (last entry in week)
  const { data: wellness } = await supabase
    .from("wellness_logs")
    .select("heart_rate, spo2, mood, stress_level, logged_at")
    .eq("user_id", userId)
    .gte("logged_at", startISO)
    .lte("logged_at", endISO)
    .order("logged_at", { ascending: false })
    .limit(7);

  const avgHR = wellness?.length
    ? Math.round(wellness.filter((w: any) => w.heart_rate > 0).reduce((s: number, w: any) => s + w.heart_rate, 0) / (wellness.filter((w: any) => w.heart_rate > 0).length || 1))
    : null;

  const avgSpO2 = wellness?.length
    ? Math.round(wellness.filter((w: any) => w.spo2 > 0).reduce((s: number, w: any) => s + w.spo2, 0) / (wellness.filter((w: any) => w.spo2 > 0).length || 1))
    : null;

  // Check-in adherence % 
  const adherencePct = totalCheckIns > 0 ? Math.round((respondedCheckIns / totalCheckIns) * 100) : 0;
  const medAdherencePct = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0;

  // Overall health score (weighted)
  const healthScore = Math.round(adherencePct * 0.5 + medAdherencePct * 0.4 + (totalSOS === 0 ? 10 : 0));

  // Missed check-in details (day + time)
  const missedCheckInDetails = (checkIns ?? [])
    .filter((c: any) => c.status === "missed")
    .map((c: any) => {
      const d = new Date(c.scheduled_at);
      return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    })
    .slice(0, 5);

  return {
    adherencePct,
    medAdherencePct,
    healthScore,
    totalCheckIns,
    respondedCheckIns,
    missedCheckIns,
    totalMeds,
    takenMeds,
    missedMeds,
    lateMeds,
    totalSOS,
    avgHR,
    avgSpO2,
    missedCheckInDetails,
  };
}

// ── Email sender ───────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string, supabase: any) {
  const apiKey = Deno.env.get("LOVABLE_EMAIL_API_KEY") || Deno.env.get("EMAIL_API_KEY");
  if (!apiKey) { console.error("No email API key set"); return; }

  // Use the same email queue pattern as send-transactional-email
  const { error } = await supabase.from("email_queue").insert({
    recipient_email: to,
    subject,
    html_body: html,
    sender_domain: SENDER_DOMAIN,
    from_domain: FROM_DOMAIN,
    status: "pending",
    idempotency_key: `weekly-report-${to}-${new Date().toISOString().slice(0, 10)}`,
  });

  if (error) {
    // Fallback: invoke send-transactional-email directly if queue insert fails
    console.error("Queue insert failed, trying direct send:", error.message);
    await supabase.functions.invoke("process-email-queue");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const triggeredBy = body.triggeredBy || "cron";

    // ── Guard: only run on Sunday 9 AM IST (when triggered by cron)
    // When triggered manually (e.g. for testing), bypass the day/hour check
    if (triggeredBy === "cron") {
      const now = nowIST();
      const isSunday = now.getDay() === 0;
      const isNineAM = now.getHours() === 9;
      if (!isSunday || !isNineAM) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "Not Sunday 9 AM IST", currentIST: now.toString() }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { weekStart, weekEnd, label } = weekRangeIST();

    // ── Fetch all active user–guardian pairs ───────────────────────────────
    const { data: guardianLinks, error: glErr } = await supabase
      .from("guardians")
      .select(`
        id,
        guardian_email,
        guardian_name,
        relation,
        user_id,
        profiles!guardians_user_id_fkey (
          full_name,
          date_of_birth
        )
      `)
      .eq("status", "accepted")
      .not("guardian_email", "is", null);

    if (glErr) throw glErr;
    if (!guardianLinks || guardianLinks.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No active guardian links found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Group by user_id so each guardian gets one email per ward ──────────
    let sentCount = 0;
    const errors: string[] = [];

    for (const link of guardianLinks) {
      if (!link.guardian_email) continue;

      try {
        const wardName = (link.profiles as any)?.full_name ?? "Your ward";
        const stats = await buildWardStats(supabase, link.user_id, weekStart, weekEnd);

        // Render email
        const html = await renderAsync(
          React.createElement(WeeklyReportEmail, {
            guardianName: link.guardian_name ?? "Guardian",
            wardName,
            weekLabel: label,
            relation: link.relation ?? "Ward",
            ...stats,
          })
        );

        const subject = `📊 ${wardName}'s Weekly Check-iN Report — ${label}`;
        await sendEmail(link.guardian_email, subject, html, supabase);

        // Log the send
        await supabase.from("notification_logs").insert({
          user_id: link.user_id,
          guardian_id: link.id,
          type: "weekly_report",
          channel: "email",
          status: "sent",
          metadata: { weekLabel: label, healthScore: stats.healthScore },
        }).catch(() => {}); // non-blocking

        sentCount++;
        console.log(`Weekly report sent → ${link.guardian_email} for ward ${wardName}`);
      } catch (err: any) {
        const msg = `Failed for guardian ${link.guardian_email}: ${err.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, errors, weekLabel: label }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("weekly-guardian-report error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
