// vault-claim-initiated: Notifies the deceased user, all their guardians,
// and admin when a Vault Nominee Claim is filed. Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { claim_id } = await req.json();
    if (!claim_id) return json({ error: "claim_id required" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claim, error: claimErr } = await supa
      .from("vault_nominee_claims")
      .select("*")
      .eq("id", claim_id)
      .single();
    if (claimErr || !claim) return json({ error: "claim not found" }, 404);

    const userId = claim.user_id;

    // Notify deceased user (in-app)
    await supa.rpc("insert_notification_deduped", {
      p_user_id: userId,
      p_title: "Vault Claim Filed",
      p_message: "A Vault Nominee claim has been filed against your account. If you receive this, log in within 7 days to cancel before release.",
      p_type: "vault_claim",
      p_guardian_id: claim.guardian_id,
    });

    // Cross-notify all OTHER guardians
    const { data: otherGuards } = await supa
      .from("guardians")
      .select("id, guardian_user_id, guardian_name")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .neq("id", claim.guardian_id);

    for (const og of otherGuards || []) {
      if (!og.guardian_user_id) continue;
      await supa.rpc("insert_notification_deduped", {
        p_user_id: og.guardian_user_id,
        p_title: "Vault Claim Notification",
        p_message: "Another guardian has filed a Vault Nominee claim. Please verify with family.",
        p_type: "vault_claim_notice",
        p_guardian_id: claim.guardian_id,
      });
    }

    // Admin notification via contact_submissions
    const { data: prof } = await supa.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
    await supa.from("contact_submissions").insert({
      full_name: prof?.full_name || "User",
      email: "system@check-in.app",
      phone: prof?.phone || null,
      subject: "Vault claim review needed",
      message: `Vault claim ${claim_id} filed for user ${userId}. Window ends ${claim.user_window_ends_at}.`,
      source: "vault-claim",
      status: "new",
      user_id: userId,
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
