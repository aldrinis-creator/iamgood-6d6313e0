// vault-cancel-claim: deceased user (alive!) cancels an open claim during
// the 7-day grace window. Auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const token = auth.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supa.auth.getClaims(token);
    if (cErr || !claims?.claims) return json({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { claim_id } = await req.json();
    if (!claim_id) return json({ error: "claim_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: claim } = await admin
      .from("vault_nominee_claims")
      .select("*")
      .eq("id", claim_id)
      .single();
    if (!claim) return json({ error: "not found" }, 404);
    if (claim.user_id !== userId) return json({ error: "forbidden" }, 403);
    if (!["docs_uploaded", "user_window_open"].includes(claim.status)) {
      return json({ error: "cannot cancel from current status" }, 400);
    }

    await admin
      .from("vault_nominee_claims")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", claim_id);

    await admin.from("admin_audit_log").insert({
      action: "vault_claim_cancelled",
      user_id: userId,
      metadata: { claim_id },
    });

    // Notify nominee guardian
    const { data: g } = await admin
      .from("guardians")
      .select("guardian_user_id")
      .eq("id", claim.guardian_id)
      .maybeSingle();
    if (g?.guardian_user_id) {
      await admin.rpc("insert_notification_deduped", {
        p_user_id: g.guardian_user_id,
        p_title: "Vault Claim Cancelled",
        p_message: "The user has cancelled the Vault claim you filed.",
        p_type: "vault_claim_cancelled",
        p_guardian_id: claim.guardian_id,
      });
    }

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
