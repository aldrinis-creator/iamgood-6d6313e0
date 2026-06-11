import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendWhatsAppTemplate } from "../_shared/msg91Whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FLOW_URL = "https://control.msg91.com/api/v5/flow";
const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 3;
const OTP_EXPIRY_MIN = 5;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-\(\)]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("91") && digits.length >= 12) return digits;
  return `91${digits}`;
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
    return false;
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
  expiresAt?: string
) {
  // Store only a SHA-256 hash of the OTP — never the plaintext code.
  const hashed = otpCode ? await sha256Hex(otpCode) : null;
  const { error } = await admin.from("otp_events").insert({
    phone,
    action,
    request_id: requestId || null,
    status,
    failure_reason: failureReason || null,
    otp_code: hashed,
    expires_at: expiresAt || null,
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
    const templateId = Deno.env.get("MSG91_OTP_TEMPLATE_ID");

    if (!authKey || !templateId) {
      console.error("[send-otp] Missing config — AUTH_KEY:", !!authKey, "TEMPLATE:", !!templateId);
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

    console.log(`[send-otp] action=${action} phone=${phone} purpose=${purpose || "login"}`);

    // ── VERIFY ──────────────────────────────────────────────
    if (action === "verify") {
      if (!otp || typeof otp !== "string" || otp.length !== 6) {
        return jsonResponse({ error: "Valid 6-digit OTP is required" }, 400);
      }

      // Look up the latest unexpired OTP for this phone
      const { data: otpRow, error: lookupErr } = await admin
        .from("otp_events")
        .select("id, otp_code, expires_at")
        .eq("phone", phone)
        .in("action", ["send", "resend"])
        .eq("status", "sent")
        .not("otp_code", "is", null)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupErr) {
        console.error("[send-otp] OTP lookup error:", lookupErr.message);
        return jsonResponse({ success: false, error: "Verification failed" }, 500);
      }

      const submittedHash = await sha256Hex(otp);
      if (!otpRow || otpRow.otp_code !== submittedHash) {
        await logOtpEvent(admin, phone, "verify_fail", undefined, "failed", "Invalid or expired OTP");
        return jsonResponse({ success: false, error: "Invalid or expired OTP" }, 400);
      }

      // Mark as verified and nullify the OTP hash
      await admin.from("otp_events").update({ verified: true, status: "verified", otp_code: null }).eq("id", otpRow.id);
      await logOtpEvent(admin, phone, "verify", undefined, "verified");

      // Registration: just confirm
      if (purpose === "register") {
        return jsonResponse({ success: true, verified: true });
      }

      // Login: generate session via magic link
      try {
        const phoneWithPlus = `+${phone}`;
        const { data: email, error: rpcError } = await admin.rpc("get_email_by_phone", { _phone: phoneWithPlus });
        console.log(`[send-otp] get_email_by_phone(${phoneWithPlus}):`, email, rpcError?.message);

        if (rpcError || !email) {
          return jsonResponse({ success: true, verified: true, no_account: true });
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
        console.log(`[send-otp] Session created for ${email}`);

        return jsonResponse({ success: true, verified: true, token_hash: tokenHash, email: email as string });
      } catch (authErr) {
        console.error("[send-otp] Auth error:", authErr);
        return jsonResponse({ success: true, verified: true, error: String(authErr) });
      }
    }

    // ── SEND / RESEND ───────────────────────────────────────
    if (await isRateLimited(admin, phone)) {
      console.log(`[send-otp] Rate limited: ${phone}`);
      return jsonResponse({ error: "Too many OTP requests. Please wait 10 minutes before trying again.", rate_limited: true }, 429);
    }

    // Generate OTP and expiry
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000).toISOString();

    // Send via MSG91 Flow API (SMS) + WhatsApp in parallel
    const flowPayload = {
      template_id: templateId,
      recipients: [{ mobiles: phone, var1: otpCode }],
    };

    const waTemplate = Deno.env.get("MSG91_WA_OTP_TEMPLATE_NAME");
    const waLanguage = Deno.env.get("MSG91_WA_OTP_LANGUAGE") ?? "en_US";

    console.log(`[send-otp] Dispatching SMS + WhatsApp for phone=${phone} (wa=${!!waTemplate})`);

    const smsPromise = fetch(FLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
        accept: "application/json",
      },
      body: JSON.stringify(flowPayload),
    }).then(async (res) => {
      const text = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = { type: "error", message: text }; }
      return { status: res.status, text, result: parsed };
    });

    const waPromise = waTemplate
      ? sendWhatsAppTemplate({
          templateName: waTemplate,
          languageCode: waLanguage,
          recipients: [{ to: [phone], components: { body_1: otpCode } }],
        })
      : Promise.resolve({ ok: false, status: 0, body: { skipped: "no template" } });

    const [smsSettled, waSettled] = await Promise.allSettled([smsPromise, waPromise]);

    // ── SMS result ──
    let smsSuccess = false;
    let smsRequestId: string | null = null;
    let smsErrorMsg: string | undefined;
    let smsRaw: any = null;
    if (smsSettled.status === "fulfilled") {
      smsRaw = smsSettled.value.result;
      smsSuccess = smsRaw?.type === "success";
      smsRequestId = smsRaw?.request_id || null;
      if (!smsSuccess) smsErrorMsg = smsRaw?.message || smsSettled.value.text;
      console.log(`[send-otp] SMS (${smsSettled.value.status}):`, smsSettled.value.text);
    } else {
      smsErrorMsg = String(smsSettled.reason);
      console.error("[send-otp] SMS threw:", smsSettled.reason);
    }

    // ── WhatsApp result ──
    let waSuccess = false;
    let waStatus: "sent" | "failed" | "skipped" = "skipped";
    let waErrorMsg: string | undefined;
    if (!waTemplate) {
      waStatus = "skipped";
    } else if (waSettled.status === "fulfilled") {
      waSuccess = waSettled.value.ok;
      waStatus = waSuccess ? "sent" : "failed";
      if (!waSuccess) waErrorMsg = JSON.stringify(waSettled.value.body);
    } else {
      waStatus = "failed";
      waErrorMsg = String(waSettled.reason);
    }

    // Persist OTP hash + log per-channel
    await logOtpEvent(
      admin,
      phone,
      action,
      smsRequestId || undefined,
      smsSuccess ? "sent" : "failed",
      smsSuccess ? undefined : smsErrorMsg,
      (smsSuccess || waSuccess) ? otpCode : undefined,
      (smsSuccess || waSuccess) ? expiresAt : undefined,
    );

    if (waTemplate) {
      await logOtpEvent(
        admin,
        phone,
        `${action}_wa`,
        undefined,
        waSuccess ? "sent" : "failed",
        waSuccess ? undefined : waErrorMsg,
      );
    }

    const channels = { sms: smsSuccess ? "sent" : "failed", whatsapp: waStatus };

    if (!smsSuccess && !waSuccess) {
      return jsonResponse({ success: false, channels, error: smsErrorMsg || waErrorMsg || "OTP delivery failed" }, 400);
    }

    return jsonResponse({ success: true, channels, result: smsRaw });
  } catch (err) {
    console.error("[send-otp] Unhandled error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
