// vault-reminder-scan: server-side daily scan of vault_reminder_meta;
// fires notifications for due rows and advances the tier ladder.
// Designed to be called daily via pg_cron, but also safe to invoke
// manually from the client as a backup to useVaultReminderScheduler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONE_DAY = 86400_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: due } = await supa
      .from("vault_reminder_meta")
      .select("*")
      .lte("next_reminder_at", new Date().toISOString())
      .neq("tier", "done");

    let fired = 0;
    for (const row of due || []) {
      const title = row.kind === "will_review" ? "Quarterly Will Review"
        : row.kind === "insurance_renewal" ? "Insurance Renewal Due"
        : "Insurance Expiry";
      const message = row.kind === "will_review"
        ? `Review your Will (${row.display_label}) — confirm if any changes are needed.`
        : `${row.display_label} ${row.kind === "insurance_renewal" ? "renews" : "expires"} on ${row.target_date || "soon"}. Open Medical Vault.`;
      await supa.rpc("insert_notification_deduped", {
        p_user_id: row.user_id, p_title: title, p_message: message,
        p_type: row.kind === "will_review" ? "will_review" : "insurance_reminder",
        p_guardian_id: null,
      });
      fired++;

      // Advance tier
      let nextTier = "done";
      let nextFire = new Date(Date.now() + 365 * ONE_DAY);
      if (row.kind === "will_review") {
        nextTier = "quarterly";
        nextFire = new Date(Date.now() + 90 * ONE_DAY);
      } else if (row.target_date) {
        const t = new Date(row.target_date).getTime();
        if (row.tier === "7d") { nextTier = "3d"; nextFire = new Date(t - 3 * ONE_DAY); }
        else if (row.tier === "3d") { nextTier = "24h"; nextFire = new Date(t - ONE_DAY); }
        else if (row.tier === "24h") { nextTier = "due"; nextFire = new Date(t); }
      }
      await supa.from("vault_reminder_meta")
        .update({ tier: nextTier, next_reminder_at: nextFire.toISOString() })
        .eq("id", row.id);
    }
    return json({ ok: true, fired });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
