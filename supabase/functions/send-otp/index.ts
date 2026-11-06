import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendWhatsAppTemplate, WA_NAMESPACE_V2 } from "../_shared/msg91Whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 4;
/** Codes stay valid for 10 minutes — WhatsApp/SMS fallback can be slow. */
const OTP_EXPIRY_MIN = 10;
/** Wrong-code tries allowed against a single code before it is burned. */
const MAX_VERIFY_ATTEMPTS = 5;
/** WhatsApp OTP template (MSG91). */
const WA_OTP_TEMPLATE = "verification_otp";
/** MSG91 SMS Flow template for OTP delivery. */
const SMS_OTP_TEMPLATE_ID = "69ce5c76e1a28470900ffe46";


function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-()]/g, "");
  // Explicit country code wins — never re-prefix an international number.
  if (cleaned.startsWith("+")) return cleaned.slice(1).replace(/[^\d]/g, "");
  const digits = cleaned.replace(/[^\d]/g, "");
  if (digits.startsWith("91") && digits.length >= 12) return digits;
  // Bare 10-digit national number: assume India (legacy default).
  if (digits.length === 10) return `91${digits}`;
  return digits;
}


function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
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
    return true;
  }
  return (count ?? 0) >= RATE_LIMIT_MAX;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function logOtpEvent(
  admin: ReturnType<typeof getAdminClient>,
  phone: string,
  action: string,
  requestId?: string,
  status = "sent",
  failureReason?: string,
  otpCode?: string,
  expiresAt?: string,
  channel?: string,
) {
  // Store only a SHA-256 hash of the OTP — never the plaintext code.
  const hashed = otpCode ? await sha256Hex(otpCode) : null;
  const { error } = await admin.from("otp_events").insert({
    phone,
    action,
    request_id: requestId || null,
    status,
    failure_reason: failureReason || null,
    otp_hash: hashed,
    expires_at: expiresAt || null,
    channel: channel || null,
  });
  if (error) console.error("[send-otp] Failed to log event:", error.message);
}


function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");

    if (!authKey) {
      console.error("[send-otp] Missing config — MSG91_AUTH_KEY");
      return jsonResponse({ error: "OTP service not configured" }, 500);
    }


    const body = await req.json();
    const action = body.action || "send";
    const rawPhone = body.phone;
    const otp = body.otp;
    const purpose = body.purpose;

    if (!rawPhone || typeof rawPhone !== "string") {
      return jsonResponse({ error: "phone is required" }, 400);
    }

    const phone = normalizePhone(rawPhone);
    const admin = getAdminClient();

    console.log(`[send-otp] action=${action} phone=***${phone.slice(-4)} purpose=${purpose || "login"}`);

    // A short-lived, phone-bound status check lets the client distinguish
    // provider acceptance from actual delivery without exposing OTP data.
    if (action === "status") {
      const requestId = typeof body.request_id === "string" ? body.request_id : "";
      if (!requestId || requestId.length > 200) {
        return jsonResponse({ error: "request_id is required" }, 400);
      }
      const { data: event } = await admin
        .from("otp_events")
        .select("delivery_status, failure_reason")
        .eq("phone", phone)
        .eq("request_id", requestId)
        .in("action", ["send", "resend"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return jsonResponse({
        success: true,
        delivery_status: event?.delivery_status ?? "pending",
        failure_reason: event?.failure_reason ? "Delivery failed. Please try the other channel." : null,
      });
    }

    // All accounts, including review accounts, use normal expiring OTP verification.

    // ── VERIFY ──────────────────────────────────────────────
    if (action === "verify") {
      if (!otp || typeof otp !== "string" || otp.length !== 6) {
        return jsonResponse({ error: "Valid 6-digit OTP is required" }, 400);
      }

      const submittedHash = await sha256Hex(otp);
      const { data: result, error: verifyError } = await admin.rpc("consume_login_otp", { _phone: phone, _hash: submittedHash });
      if (verifyError) return jsonResponse({ success: false, error: "Verification failed" }, 500);
      if (result !== "verified") {
        await logOtpEvent(admin, phone, "verify_fail", undefined, "failed", String(result));
        const errors: Record<string, string> = {
          expired: "This code has expired. Please request a new one.",
          too_many_attempts: "Too many incorrect attempts. Please request a new code.",
          wrong_code: "That code is not correct. Please re-check the latest message.",
        };
        return jsonResponse({ success: false, code: result, error: errors[String(result)] || "Verification failed" }, 400);
      }
      await logOtpEvent(admin, phone, "verify", undefined, "verified");

      // Registration: just confirm
      if (purpose === "register") {
        return jsonResponse({ success: true, verified: true });
      }

      // Login: generate session via magic link
      try {
        const phoneWithPlus = `+${phone}`;
        const { data: email, error: rpcError } = await admin.rpc("get_email_by_phone", { _phone: phoneWithPlus });
        console.log("[send-otp] account lookup completed");

        if (rpcError || !email) {
          return jsonResponse({ success: true, verified: true, no_account: true });
        }

        // An administrator-blocked account cannot start a new session.
        const { data: accessRow } = await admin
          .from("profiles")
          .select("blocked_at, blocked_reason")
          .eq("phone", phoneWithPlus)
          .limit(1)
          .maybeSingle();
        if (accessRow?.blocked_at) {
          await logOtpEvent(admin, phone, "verify_blocked", undefined, "failed", "Account blocked");
          return jsonResponse({
            success: true,
            verified: true,
            blocked: true,
            error: "This account has been blocked from signing in. Please contact Check-iN support.",
          });
        }

        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: email as string,
        });

        if (linkError || !linkData) {
          console.error("[send-otp] Magic link generation failed:", linkError?.message);
          return jsonResponse({ success: true, verified: true, error: "Failed to create session" });
        }

        const tokenHash = linkData.properties?.hashed_token;
        console.log("[send-otp] session created");

        return jsonResponse({ success: true, verified: true, token_hash: tokenHash, email: email as string });
      } catch (authErr) {
        console.error("[send-otp] Auth error:", authErr);
        return jsonResponse({ success: true, verified: true, error: String(authErr) });
      }
    }

    // ── SEND / RESEND ───────────────────────────────────────
    // Guardian invite path: never dispatch to a number the ward did not invite.
    const nominationToken = typeof body.nomination_token === "string" ? body.nomination_token : null;
    if (nominationToken) {
      const { data: nom } = await admin
        .from("guardians")
        .select("guardian_phone")
        .eq("nomination_token", nominationToken)
        .maybeSingle();
      const invited = nom?.guardian_phone ? normalizePhone(nom.guardian_phone) : null;
      if (invited && invited !== phone) {
        const masked = `+${invited.slice(0, 4)}\u2026${invited.slice(-3)}`;
        console.warn("[send-otp] nomination phone mismatch");
        return jsonResponse(
          { error: `This invite was sent to ${masked}. Please use that number, or ask your ward to re-send the invite.` },
          400,
        );
      }
    }

    // Channel choice: the guardian/user picks WhatsApp or SMS on the screen.
    const channel: "sms" | "whatsapp" = body.channel === "sms" ? "sms" : "whatsapp";

    // Reuse a live code on a plain "send" (screen re-entry / auto-request) so we
    // never invalidate a code that is already on its way to the phone.
    if (action === "send") {
      const { data: live } = await admin
        .from("otp_events")
        .select("id, request_id, expires_at, channel")
        .eq("phone", phone)
        .in("action", ["send", "resend"])
        .eq("status", "sent")
        .not("otp_hash", "is", null)
        .gte("expires_at", new Date().toISOString())
        .eq("channel", channel)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (live) {
        const secondsLeft = Math.max(0, Math.floor((new Date(live.expires_at).getTime() - Date.now()) / 1000));
        console.log("[send-otp] reusing live code");
        return jsonResponse({
          success: true,
          reused: true,
          channel,
          channels: { [channel]: "reused" },
          request_id: live.request_id ?? null,
          expires_in: secondsLeft,
        });
      }
    }

    if (await isRateLimited(admin, phone)) {
      console.log("[send-otp] rate limited");
      return jsonResponse({ error: "Too many OTP requests. Please wait 10 minutes before trying again.", rate_limited: true }, 429);
    }

    // Generate OTP and expiry
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000).toISOString();

    let sendSuccess = false;
    let sendErrorMsg: string | undefined;
    let sendRequestId: string | undefined;

    if (channel === "sms") {
      // ── MSG91 SMS FLOW ───────────────────────────────────
      console.log("[send-otp] dispatching SMS");
      try {
        const smsRes = await fetch("https://control.msg91.com/api/v5/flow", {
          method: "POST",
          headers: { "Content-Type": "application/json", authkey: authKey },
          body: JSON.stringify({
            template_id: SMS_OTP_TEMPLATE_ID,
            short_url: "0",
            recipients: [{ mobiles: phone, otp: otpCode, var1: otpCode, OTP: otpCode }],
          }),
        });
        const resBody: any = await smsRes.json().catch(() => ({}));
        console.log("[send-otp] SMS response status", smsRes.status);
        sendRequestId = resBody?.request_id || (typeof resBody?.message === "string" ? resBody.message : undefined);
        if (smsRes.ok && resBody?.type !== "error") {
          sendSuccess = true;
        } else {
          sendErrorMsg = JSON.stringify(resBody).slice(0, 300);
        }
      } catch (e) {
        sendErrorMsg = String(e);
        console.error("[send-otp] SMS flow error:", e);
      }
    } else {
      // ── MSG91 WHATSAPP TEMPLATE ──────────────────────────
      console.log("[send-otp] dispatching WhatsApp");
      try {
        const wa = await sendWhatsAppTemplate({
          templateName: WA_OTP_TEMPLATE,
          languageCode: "en",
          namespace: WA_NAMESPACE_V2,
          recipients: [{ to: [phone], components: { body_1: otpCode, button_1_url: otpCode } }],
        });
        const waBody: any = wa.body;
        sendRequestId =
          waBody?.data?.request_id ||
          waBody?.request_id ||
          (typeof waBody?.message === "string" ? waBody.message : undefined);
        sendSuccess = wa.ok;
        if (!wa.ok) sendErrorMsg = JSON.stringify(waBody).slice(0, 300);
        console.log("[send-otp] WhatsApp response status", wa.status);
      } catch (e) {
        sendErrorMsg = String(e);
        console.error("[send-otp] WhatsApp OTP error:", e);
      }
    }

    await logOtpEvent(
      admin,
      phone,
      action,
      sendRequestId,
      sendSuccess ? "sent" : "failed",
      sendErrorMsg,
      sendSuccess ? otpCode : undefined,
      sendSuccess ? expiresAt : undefined,
      channel,
    );

    const channels = { [channel]: sendSuccess ? "sent" : "failed" };

    if (!sendSuccess) {
      return jsonResponse({ success: false, channel, channels, error: sendErrorMsg || "OTP delivery failed" }, 400);
    }

    return jsonResponse({
      success: true,
      channel,
      channels,
      request_id: sendRequestId ?? null,
      expires_in: OTP_EXPIRY_MIN * 60,
    });


  } catch (err) {
    console.error("[send-otp] Unhandled error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
