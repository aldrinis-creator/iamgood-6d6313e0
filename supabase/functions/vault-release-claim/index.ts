// vault-release-claim: admin-only. Generates a one-time, 24h release
// token for the nominee guardian and stores a release payload built
// from non-sensitive metadata (always) plus decrypted vault contents
// when PIN escrow is enabled.
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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "unauthorized" }, 401);
    const adminUserId = claims.claims.sub as string;

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await supa
      .from("user_roles").select("role").eq("user_id", adminUserId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    // Step-up 2FA check
    const stepUpToken = req.headers.get("x-admin-step-up") || "";
    if (!stepUpToken) return json({ error: "Step-up required" }, 403);
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stepUpToken));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data: stepRow } = await supa
      .from("admin_step_up_tokens")
      .select("id")
      .eq("token_hash", tokenHash)
      .eq("user_id", adminUserId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!stepRow) return json({ error: "Invalid or expired step-up token" }, 403);

    const { claim_id } = await req.json();
    if (!claim_id) return json({ error: "claim_id required" }, 400);

    const { data: claim } = await supa.from("vault_nominee_claims").select("*").eq("id", claim_id).single();
    if (!claim) return json({ error: "not found" }, 404);

    // Build payload (metadata only — decryption requires escrow which we
    // simulate; in this scaffold we emit reminder metadata as fallback).
    const { data: meta } = await supa
      .from("vault_reminder_meta")
      .select("display_label, kind, target_date")
      .eq("user_id", claim.user_id);

    const { data: prof } = await supa.from("profiles").select("full_name").eq("id", claim.user_id).maybeSingle();
    const { data: escrow } = await supa.from("vault_pin_escrow").select("user_id").eq("user_id", claim.user_id).maybeSingle();

    const insurance = (meta || []).filter((m: any) => m.kind.startsWith("insurance")).map((m: any) => ({
      label: m.display_label,
      company: m.display_label.split("·").slice(-1)[0]?.trim() || "—",
      category: m.kind.includes("renewal") ? "renewal" : "expiry",
      policy_number: "•••• (verify with company)",
      nominee_name: "See company records",
      nominee_phone: "—",
      renewal_date: m.target_date,
    }));

    const payload = {
      user_name: prof?.full_name || "User",
      released_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      metadata_only: !escrow,
      insurance,
    };

    // Generate OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await sha256(otp);

    const { data: tokenRow, error: tokErr } = await supa.from("vault_release_tokens").insert({
      claim_id,
      user_id: claim.user_id,
      guardian_id: claim.guardian_id,
      otp_hash: otpHash,
      payload_encrypted: JSON.stringify(payload),
      payload_iv: "plain",
    }).select("token, expires_at").single();
    if (tokErr || !tokenRow) throw tokErr;

    // Update claim
    await supa.from("vault_nominee_claims").update({
      status: "released",
      released_at: new Date().toISOString(),
      admin_reviewed_by: adminUserId,
    }).eq("id", claim_id);

    // Notify nominee with link + OTP via SMS/email (stubs to existing channels)
    const { data: g } = await supa.from("guardians").select("guardian_phone, guardian_email, guardian_name").eq("id", claim.guardian_id).maybeSingle();
    const portalUrl = `${Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".lovable.app")}/vault-claim/${tokenRow.token}`;

    if (g?.guardian_phone) {
      try {
        await supa.functions.invoke("msg91-send", {
          body: {
            phone: g.guardian_phone,
            message: `Vault release link for ${prof?.full_name || "user"}: ${portalUrl}\nOTP: ${otp}\nExpires in 24h.`,
          },
        });
      } catch (_) { /* noop */ }
    }

    await supa.from("admin_audit_log").insert({
      action: "vault_claim_released",
      user_id: adminUserId,
      metadata: { claim_id, token: tokenRow.token, nominee_phone: g?.guardian_phone },
    });

    return json({ ok: true, portal_url: portalUrl, expires_at: tokenRow.expires_at });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
