import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "npm:@supabase/supabase-js@2";
import { WeeklyGuardianReportEmail } from "../_shared/transactional-email-templates/weekly-guardian-report.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "Check-iN";
const SENDER_DOMAIN = "notify.futurewave.in";
const FROM_DOMAIN = "futurewave.in";

// ── IST helpers ────────────────────────────────────────────────────────────
function nowIST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function prevWeekRangeIST(): { weekStart: Date; weekEnd: Date; label: string } {
  const now = nowIST();
  // Get previous Monday 00:00 IST → previous Sunday 23:59 IST
  const dow = now.getDay(); // 0=Sun
  const daysToLastMon = dow === 0 ? 6 : dow - 1;
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() - dow); // last Sunday
  weekEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6); // Monday before that Sunday
  weekStart.setHours(0, 0, 0, 0);

  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
  return { weekStart, weekEnd, label: `${fmt(weekStart)} – ${fmt(weekEnd)}` };
}

// ── Build stats for one ward ───────────────────────────────────────────────
async function buildStats(supabase: ReturnType<typeof createClient>, userId: string, weekStart: Date, weekEnd: Date) {
  const s = weekStart.toISOString();
  const e = weekEnd.toISOString();

  const [{ data: checkIns }, { data: medLogs }, { data: sosEvents }, { data: wellness }] = await Promise.all([
    supabase
      .from("check_ins")
      .select("status, scheduled_at")
      .eq("user_id", userId)
      .gte("scheduled_at", s)
      .lte("scheduled_at", e),

    supabase
      .from("medication_logs")
      .select("status, scheduled_at")
      .eq("user_id", userId)
      .gte("scheduled_at", s)
      .lte("scheduled_at", e),

    supabase
      .from("sos_events")
      .select("triggered_at")
      .eq("user_id", userId)
      .gte("triggered_at", s)
      .lte("triggered_at", e),

    supabase
      .from("wellness_logs")
      .select("heart_rate, spo2, log_date")
      .eq("user_id", userId)
      .gte("log_date", s.slice(0, 10))
      .lte("log_date", e.slice(0, 10)),
  ]);

  const ci = checkIns || [];
  const ml = medLogs || [];
  const sos = sosEvents || [];
  const wl = wellness || [];

  const totalCheckIns = ci.length;
  const respondedCheckIns = ci.filter((r: any) => r.status === "responded").length;
  const missedCheckIns = ci.filter((r: any) => r.status === "missed").length;

  const totalMeds = ml.length;
  const takenMeds = ml.filter((r: any) => r.status === "taken" || r.status === "taken_late").length;
  const missedMeds = ml.filter((r: any) => r.status === "missed").length;
  const lateMeds = ml.filter((r: any) => r.status === "taken_late").length;
  const totalSOS = sos.length;

  const adherencePct = totalCheckIns > 0 ? Math.round((respondedCheckIns / totalCheckIns) * 100) : 0;
  const medAdherencePct = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0;
  const healthScore = Math.round(adherencePct * 0.5 + medAdherencePct * 0.4 + (totalSOS === 0 ? 10 : 0));

  // Wellness averages
  const hrVals = wl.filter((w: any) => w.heart_rate > 0).map((w: any) => w.heart_rate);
  const spo2Vals = wl.filter((w: any) => w.spo2 > 0).map((w: any) => w.spo2);
  const avgHR =
    hrVals.length > 0 ? Math.round(hrVals.reduce((a: number, b: number) => a + b, 0) / hrVals.length) : null;
  const avgSpO2 =
    spo2Vals.length > 0 ? Math.round(spo2Vals.reduce((a: number, b: number) => a + b, 0) / spo2Vals.length) : null;

  // Missed check-in timestamps for the email detail section
  const missedCheckInDetails = ci
    .filter((r: any) => r.status === "missed")
    .map((r: any) => {
      const d = new Date(r.scheduled_at);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
    })
    .slice(0, 5);

  return {
    healthScore,
    adherencePct,
    medAdherencePct,
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

// ══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const triggeredBy: string = body.triggeredBy || "cron";

    // ── Guard: only run on Sunday when called by cron ──────────
    if (triggeredBy === "cron") {
      const now = nowIST();
      if (now.getDay() !== 0) {
        return new Response(JSON.stringify({ skipped: true, reason: "Not Sunday", ist: now.toString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { weekStart, weekEnd, label } = prevWeekRangeIST();

    // ── Fetch all accepted guardian rows that have an email ──────────────
    const { data: guardians, error: gErr } = await supabase
      .from("guardians")
      .select("id, guardian_email, guardian_name, relation, user_id, status")
      .eq("status", "accepted")
      .not("guardian_email", "is", null)
      .neq("guardian_email", "");

    if (gErr) throw gErr;
    if (!guardians || guardians.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No accepted guardians with email found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── For each guardian, look up ward name from profiles ───────────────
    const userIds = [...new Set(guardians.map((g: any) => g.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);

    const profileMap: Record<string, string> = {};
    for (const p of profiles || []) {
      profileMap[p.id] = p.full_name || "Your ward";
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const g of guardians) {
      if (!g.guardian_email) continue;

      // Idempotency key — prevents duplicate emails if function is called twice in same hour
      const idempotencyKey = `weekly-report-${g.id}-${weekEnd.toISOString().slice(0, 10)}`;

      // Check if already sent this week
      const { data: alreadySent } = await supabase
        .from("transactional_email_log")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (alreadySent) {
        console.log(`Already sent for guardian ${g.id} this week — skipping`);
        continue;
      }

      try {
        const wardName = profileMap[g.user_id] || "Your ward";
        const stats = await buildStats(supabase, g.user_id, weekStart, weekEnd);

        // Render email HTML
        const html = await renderAsync(
          React.createElement(WeeklyGuardianReportEmail, {
            guardianName: g.guardian_name,
            wardName,
            weekLabel: label,
            relation: g.relation || "Ward",
            ...stats,
          }),
        );

        const subject = `📊 ${wardName}'s Weekly Check-iN Report — ${label}`;

        // ── Send via send-transactional-email (same path as all other emails) ──
        const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "weekly-guardian-report",
            recipientEmail: g.guardian_email,
            idempotencyKey,
            // Pass pre-rendered HTML directly so send-transactional-email
            // doesn't need to look up the template again
            templateData: {
              guardianName: g.guardian_name,
              wardName,
              weekLabel: label,
              relation: g.relation || "Ward",
              ...stats,
            },
          },
        });

        if (sendErr) throw new Error(String(sendErr));

        sentCount++;
        console.log(`Weekly report sent → ${g.guardian_email} for ward ${wardName}`);
      } catch (err: any) {
        const msg = `Guardian ${g.guardian_email} (ward: ${g.user_id}): ${err.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, errors, weekLabel: label }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("weekly-guardian-report fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
