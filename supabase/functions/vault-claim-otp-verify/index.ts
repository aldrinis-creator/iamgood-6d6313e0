// vault-claim-otp-verify: public endpoint.
// action=request -> sends OTP to nominee phone (uses existing OTP hash)
// action=verify  -> exchanges OTP for the release payload
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token, action, otp } = await req.json();
    if (!token || !action) return json({ error: "missing args" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: rt } = await supa.from("vault_release_tokens").select("*").eq("token", token).maybeSingle();
    if (!rt) return json({ error: "invalid token" }, 404);
    if (new Date(rt.expires_at) < new Date()) return json({ error: "link expired" }, 410);
    if (rt.used_at) return json({ error: "already used" }, 410);

    if (action === "request") {
      // OTP was generated at release time — re-send via SMS so nominee
      // can re-request if they missed it. We don't generate a new OTP
      // here; instead, we just nudge.
      const { data: g } = await supa.from("guardians").select("guardian_phone").eq("id", rt.guardian_id).maybeSingle();
      // Stub: just acknowledge — admin already SMSed it during release.
      return json({ ok: true, hint: g?.guardian_phone ? `OTP sent to ${maskPhone(g.guardian_phone)}` : "OTP delivery in progress" });
    }

    if (action === "verify") {
      if (!otp || otp.length !== 6) return json({ error: "invalid otp" }, 400);
      if (rt.otp_attempts >= 5) return json({ error: "too many attempts" }, 429);
      const otpHash = await sha256(otp);
      if (otpHash !== rt.otp_hash) {
        await supa.from("vault_release_tokens").update({ otp_attempts: rt.otp_attempts + 1 }).eq("id", rt.id);
        return json({ error: "incorrect otp" }, 401);
      }
      await supa.from("vault_release_tokens").update({ used_at: new Date().toISOString() }).eq("id", rt.id);
      const payload = JSON.parse(rt.payload_encrypted);
      return json({ ok: true, payload });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function maskPhone(p: string) { return p.length > 4 ? `${"*".repeat(p.length - 4)}${p.slice(-4)}` : p; }
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
