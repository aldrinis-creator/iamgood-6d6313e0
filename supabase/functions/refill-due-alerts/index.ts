import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireCronOrAdmin, serviceClient } from "../_shared/guard.ts";
import { pushToUser } from "../_shared/webPush.ts";
import { istToday, medsToAlert, type RefillMed } from "../_shared/refillRules.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const dryRun = body?.dryRun === true;
  const sb = serviceClient();
  const today = istToday();

  const { data: meds, error } = await sb.from("medications")
    .select("id, user_id, name, remaining_quantity, low_stock_threshold, refill_reminder, refill_due_since")
    .not("refill_due_since", "is", null);
  if (error) return json({ error: "Could not load medicines" }, 500);

  const ids = (meds || []).map((m: any) => m.id);
  const alerted: Record<string, string[]> = {};
  if (ids.length) {
    const { data: logs } = await sb.from("refill_alert_log").select("medication_id, alert_date").in("medication_id", ids);
    for (const l of logs || []) (alerted[l.medication_id] ||= []).push(l.alert_date);
  }

  const groups = medsToAlert((meds || []) as RefillMed[], today, alerted);
  const results: any[] = [];

  for (const [wardId, list] of groups) {
    const names = list.map((m) => m.name).join(", ");
    const { data: prof } = await sb.from("profiles").select("full_name").eq("id", wardId).maybeSingle();
    const wardName = prof?.full_name || "Your Ward";
    const { data: guardians } = await sb.from("guardians")
      .select("id, guardian_user_id").eq("user_id", wardId).eq("status", "accepted");

    if (dryRun) { results.push({ wardId, meds: list.length, guardians: guardians?.length || 0 }); continue; }

    const { error: logErr } = await sb.from("refill_alert_log").insert(
      list.map((m) => ({ medication_id: m.id, user_id: wardId, alert_date: today })),
    );
    if (logErr) { results.push({ wardId, skipped: "already sent" }); continue; }

    const wardTitle = list.length > 1 ? "Medicines due for refill" : "Medicine due for refill";
    const wardMsg = `Time to refill: ${names}.`;
    const notifs: any[] = [{ user_id: wardId, title: wardTitle, message: wardMsg, type: "refill_due" }];
    await pushToUser(sb, wardId, { title: wardTitle, body: wardMsg, type: "refill_due", tag: `refill-${today}`, url: "/my-health?refill=1" });

    for (const g of guardians || []) {
      if (!g.guardian_user_id) continue;
      const t = `${wardName}: refill due`;
      const msg = `${wardName}'s medicine${list.length > 1 ? "s need" : " needs"} a refill: ${names}.`;
      notifs.push({ user_id: g.guardian_user_id, title: t, message: msg, type: "refill_due", guardian_id: g.id });
      await pushToUser(sb, g.guardian_user_id, { title: t, body: msg, type: "refill_due", tag: `refill-${wardId}-${today}`, url: "/guardian?refill=1" });
    }
    await sb.rpc("insert_notifications_deduped", { p_notifications: notifs });
    results.push({ wardId, meds: list.length, notified: notifs.length });
  }

  return json({ today, dryRun, wards: results.length, results });
});
