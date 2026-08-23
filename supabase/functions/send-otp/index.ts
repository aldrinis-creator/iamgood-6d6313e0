import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendWhatsAppTemplate } from "../_shared/msg91Whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 3;
const OTP_EXPIRY_MIN = 5;

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

/** App Store reviewer accounts: fixed OTP, no SMS/WhatsApp dispatch, no rate limit. */
function reviewPhones(): string[] {
  return (Deno.env.get("REVIEW_PHONES") ?? "")
    .split(",")
    .map((p) => normalizePhone(p.trim()))
    .filter((p) => p.length >= 12);
}

function isReviewPhone(phone: string): boolean {
  return reviewPhones().includes(phone);
}

/** Give a reviewer account full premium access for 30 days if they have none active. */
async function ensureReviewAccess(admin: ReturnType<typeof getAdminClient>, userId: string) {
  try {
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (existing) return;

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("subscriptions").insert({
      user_id: userId,
      plan_type: "premium",
      billing_cycle: "monthly",
      status: "active",
      amount_paise: 0,
      coupon_code: "APPSTORE_REVIEW",
      expires_at: expires,
    });
  } catch (e) {
    console.error("[send-otp] ensureReviewAccess failed:", e);
  }
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
    otp_hash: hashed,
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

    console.log(`[send-otp] action=${action} phone=${phone} purpose=${purpose || "login"}`);

    // ── APP STORE REVIEW BYPASS ─────────────────────────────
    if (isReviewPhone(phone)) {
      const reviewCode = Deno.env.get("REVIEW_OTP_CODE") ?? "";

      if (action !== "verify") {
        console.log(`[send-otp] review bypass: skipping dispatch for ${phone}`);
        await logOtpEvent(admin, phone, "review_bypass", undefined, "sent");
        return jsonResponse({ success: true, channels: { sms: "skipped", whatsapp: "skipped" } });
      }

      if (!reviewCode || otp !== reviewCode) {
        await logOtpEvent(admin, phone, "review_bypass_fail", undefined, "failed", "Invalid review code");
        return jsonResponse({ success: false, error: "Invalid or expired OTP" }, 400);
      }

      await logOtpEvent(admin, phone, "review_bypass_verify", undefined, "verified");

      if (purpose === "register") {
        return jsonResponse({ success: true, verified: true });
      }

      const phoneWithPlus = `+${phone}`;
      const { data: email, error: rpcError } = await admin.rpc("get_email_by_phone", { _phone: phoneWithPlus });
      if (rpcError || !email) {
        return jsonResponse({ success: true, verified: true, no_account: true });
      }

      const { data: userRow } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", phoneWithPlus)
        .limit(1)
        .maybeSingle();
      if (userRow?.id) await ensureReviewAccess(admin, userRow.id);

      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: email as string,
      });
      if (linkError || !linkData) {
        console.error("[send-otp] review magic link failed:", linkError?.message);
        return jsonResponse({ success: true, verified: true, error: "Failed to create session" });
      }

      return jsonResponse({
        success: true,
        verified: true,
        token_hash: linkData.properties?.hashed_token,
        email: email as string,
      });
    }


    // ── VERIFY ──────────────────────────────────────────────
    if (action === "verify") {
      if (!otp || typeof otp !== "string" || otp.length !== 6) {
        return jsonResponse({ error: "Valid 6-digit OTP is required" }, 400);
      }

      // Look up the latest unexpired OTP for this phone
      const { data: otpRow, error: lookupErr } = await admin
        .from("otp_events")
        .select("id, otp_hash, expires_at")
        .eq("phone", phone)
        .in("action", ["send", "resend"])
        .eq("status", "sent")
        .not("otp_hash", "is", null)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupErr) {
        console.error("[send-otp] OTP lookup error:", lookupErr.message);
        return jsonResponse({ success: false, error: "Verification failed" }, 500);
      }

      const submittedHash = await sha256Hex(otp);
      if (!otpRow || otpRow.otp_hash !== submittedHash) {
        await logOtpEvent(admin, phone, "verify_fail", undefined, "failed", "Invalid or expired OTP");
        return jsonResponse({ success: false, error: "Invalid or expired OTP" }, 400);
      }

      // Mark as verified and nullify the OTP hash
      await admin.from("otp_events").update({ verified: true, status: "verified", otp_hash: null }).eq("id", otpRow.id);
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
        console.warn(`[send-otp] nomination phone mismatch: typed=${phone} invited=${invited}`);
        return jsonResponse(
          { error: `This invite was sent to ${masked}. Please use that number, or ask your ward to re-send the invite.` },
          400,
        );
      }
    }

    if (await isRateLimited(admin, phone)) {
      console.log(`[send-otp] Rate limited: ${phone}`);
      return jsonResponse({ error: "Too many OTP requests. Please wait 10 minutes before trying again.", rate_limited: true }, 429);
    }

    // Generate OTP and expiry
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000).toISOString();

    // MSG91 Flow Delivery (handles WhatsApp with SMS Fallback natively)
    console.log(`[send-otp] Dispatching MSG91 otp-fallback Flow for phone=${phone}`);

    const flowPayload = {
      data: {
        sendTo: [
          {
            to: [
              {
                mobiles: phone,
                variables: {
                  body_1: { type: "text", value: otpCode },
                  button_1: { type: "text", subtype: "url", value: otpCode },
                  var1: { value: otpCode }
                }
              }
            ],
            variables: {
              body_1: { type: "text", value: otpCode },
              button_1: { type: "text", subtype: "url", value: otpCode },
              var1: { value: otpCode }
            }
          }
        ]
      }
    };

    let flowSuccess = false;
    let flowErrorMsg: string | undefined;
    let flowRequestId: string | undefined;

    try {
      const flowRes = await fetch("https://control.msg91.com/api/v5/oneapi/api/flow/otp-fallback/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify(flowPayload),
      });

      const resBody: any = await flowRes.json().catch(() => ({}));
      console.log(`[send-otp] MSG91 flow response (${flowRes.status}):`, JSON.stringify(resBody).slice(0, 500));

      flowRequestId =
        resBody?.data?.[0]?.requestId ||
        resBody?.data?.requestId ||
        resBody?.request_id ||
        (typeof resBody?.message === "string" ? resBody.message : undefined);

      if (flowRes.ok && resBody?.type !== "error") {
        flowSuccess = true;
        if (!flowRequestId) {
          // Accepted but no tracking id returned — keep the send, but record it.
          flowErrorMsg = `no request_id: ${JSON.stringify(resBody).slice(0, 200)}`;
        }
      } else {
        flowErrorMsg = JSON.stringify(resBody).slice(0, 300);
        console.error(`[send-otp] Flow failed: ${flowRes.status}`, flowErrorMsg);
      }
    } catch (e) {
      flowErrorMsg = String(e);
      console.error(`[send-otp] Flow error:`, e);
    }

    await logOtpEvent(
      admin,
      phone,
      action,
      flowRequestId,
      flowSuccess ? "sent" : "failed",
      flowErrorMsg,
      flowSuccess ? otpCode : undefined,
      flowSuccess ? expiresAt : undefined,
    );

    const channels = { flow: flowSuccess ? "sent" : "failed" };

    if (!flowSuccess) {
      return jsonResponse({ success: false, channels, error: flowErrorMsg || "OTP delivery failed" }, 400);
    }

    return jsonResponse({ success: true, channels, request_id: flowRequestId ?? null });

  } catch (err) {
    console.error("[send-otp] Unhandled error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
