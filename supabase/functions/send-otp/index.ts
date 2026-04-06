import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_BASE = "https://control.msg91.com/api/v5";
const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 3;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-\(\)]/g, "");
  if (digits.startsWith("+")) return digits.slice(1); // strip + for MSG91
  if (digits.startsWith("91") && digits.length >= 12) return digits;
  return `91${digits}`;
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function isRateLimited(admin: ReturnType<typeof getAdminClient>, phone: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("otp_events")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .in("action", ["send", "resend"])
    .gte("created_at", since);

  if (error) {
    console.error("[send-otp] Rate limit check failed:", error.message);
    return false; // fail open — don't block user on DB error
  }
  return (count ?? 0) >= RATE_LIMIT_MAX;
}

async function logOtpEvent(
  admin: ReturnType<typeof getAdminClient>,
  phone: string,
  action: string,
  requestId?: string,
  status = "sent",
  failureReason?: string
) {
  const { error } = await admin.from("otp_events").insert({
    phone,
    action,
    request_id: requestId || null,
    status,
    failure_reason: failureReason || null,
  });
  if (error) console.error("[send-otp] Failed to log event:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const templateId = Deno.env.get("MSG91_OTP_TEMPLATE_ID");

    if (!authKey || !templateId) {
      console.error("[send-otp] Missing config — AUTH_KEY:", !!authKey, "TEMPLATE:", !!templateId);
      return new Response(
        JSON.stringify({ error: "OTP service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const action = body.action || "send";
    const rawPhone = body.phone;
    const otp = body.otp;
    const purpose = body.purpose;

    if (!rawPhone || typeof rawPhone !== "string") {
      return new Response(
        JSON.stringify({ error: "phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = normalizePhone(rawPhone);
    const admin = getAdminClient();

    console.log(`[send-otp] action=${action} phone=${phone} purpose=${purpose || "login"}`);

    // ── VERIFY ──────────────────────────────────────────────
    if (action === "verify") {
      if (!otp || typeof otp !== "string" || otp.length !== 6) {
        return new Response(
          JSON.stringify({ error: "Valid 6-digit OTP is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const verifyUrl = `${MSG91_BASE}/otp/verify?otp=${otp}&mobile=${phone}`;
      const res = await fetch(verifyUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json", authkey: authKey },
      });
      const text = await res.text();
      console.log(`[send-otp] Verify response (${res.status}):`, text);

      let result: any;
      try { result = JSON.parse(text); } catch { result = { type: "error", message: text }; }

      const verified = result.type === "success" || result.type === "otp_verified";

      if (!verified) {
        await logOtpEvent(admin, phone, "verify_fail", undefined, "failed", result.message || text);
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Invalid OTP" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark verified in logs
      await logOtpEvent(admin, phone, "verify", undefined, "verified");

      // Registration: just confirm
      if (purpose === "register") {
        return new Response(
          JSON.stringify({ success: true, verified: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Login: generate session via magic link
      try {
        const phoneWithPlus = `+${phone}`;
        const { data: email, error: rpcError } = await admin.rpc("get_email_by_phone", { _phone: phoneWithPlus });
        console.log(`[send-otp] get_email_by_phone(${phoneWithPlus}):`, email, rpcError?.message);

        if (rpcError || !email) {
          return new Response(
            JSON.stringify({ success: true, verified: true, no_account: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: email as string,
        });

        if (linkError || !linkData) {
          console.error("[send-otp] Magic link generation failed:", linkError?.message);
          return new Response(
            JSON.stringify({ success: true, verified: true, error: "Failed to create session" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const tokenHash = linkData.properties?.hashed_token;
        console.log(`[send-otp] Session created for ${email}`);

        return new Response(
          JSON.stringify({ success: true, verified: true, token_hash: tokenHash, email: email as string }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (authErr) {
        console.error("[send-otp] Auth error:", authErr);
        return new Response(
          JSON.stringify({ success: true, verified: true, error: String(authErr) }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── SEND / RESEND ───────────────────────────────────────
    // Rate limit check (durable, DB-backed)
    if (await isRateLimited(admin, phone)) {
      console.log(`[send-otp] Rate limited: ${phone}`);
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please wait 10 minutes before trying again.", rate_limited: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authkey: authKey,
    };

    let url: string;
    let method = "POST";

    if (action === "resend") {
      // Use MSG91 retry endpoint for consistent session handling
      url = `${MSG91_BASE}/otp/retry?authkey=${authKey}&retrytype=text&mobile=${phone}`;
      method = "GET";
    } else {
      // Fresh OTP send
      url = `${MSG91_BASE}/otp?template_id=${templateId}&mobile=${phone}`;
      method = "POST";
    }

    console.log(`[send-otp] Calling MSG91: ${method} ${url}`);
    const res = await fetch(url, { method, headers });
    const resultText = await res.text();
    console.log(`[send-otp] MSG91 response (${res.status}):`, resultText);

    let result: any;
    try { result = JSON.parse(resultText); } catch { result = { type: "error", message: resultText }; }

    const success = result.type === "success";
    const requestId = result.request_id || null;

    // Log to DB
    await logOtpEvent(
      admin,
      phone,
      action,
      requestId,
      success ? "sent" : "failed",
      success ? undefined : (result.message || resultText)
    );

    if (!success) {
      // If retry failed, try a fresh send as fallback
      if (action === "resend") {
        console.log("[send-otp] Retry failed, attempting fresh send as fallback");
        const fallbackUrl = `${MSG91_BASE}/otp?template_id=${templateId}&mobile=${phone}`;
        const fbRes = await fetch(fallbackUrl, { method: "POST", headers });
        const fbText = await fbRes.text();
        console.log(`[send-otp] Fallback response (${fbRes.status}):`, fbText);

        let fbResult: any;
        try { fbResult = JSON.parse(fbText); } catch { fbResult = { type: "error", message: fbText }; }

        const fbSuccess = fbResult.type === "success";
        await logOtpEvent(admin, phone, "send_fallback", fbResult.request_id || null, fbSuccess ? "sent" : "failed", fbSuccess ? undefined : (fbResult.message || fbText));

        return new Response(
          JSON.stringify({ success: fbSuccess, result: fbResult }),
          { status: fbSuccess ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, result, error: result.message || "SMS delivery failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-otp] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
