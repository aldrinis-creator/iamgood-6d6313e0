import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STEP_UP_TTL_MS = 30 * 60 * 1000; // 30 min
const CODE_TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 10 * 60 * 1000;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function logAudit(adminClient: any, user_id: string | null, action: string, req: Request, metadata: any = {}) {
  try {
    await adminClient.from("admin_audit_log").insert({
      user_id,
      action,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
      metadata,
    });
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    if (!isAdmin) {
      await logAudit(adminClient, user.id, "2fa_unauthorized", req);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Load admin contact config
    const { data: config } = await adminClient.from("admin_2fa_config").select("*").limit(1).maybeSingle();
    if (!config) {
      return new Response(JSON.stringify({ error: "Admin 2FA not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      // Lockout check
      const since = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();
      const { data: failedAudits } = await adminClient
        .from("admin_audit_log")
        .select("id")
        .eq("user_id", user.id)
        .eq("action", "2fa_failed")
        .gte("created_at", since);
      if ((failedAudits?.length || 0) >= MAX_ATTEMPTS) {
        return new Response(JSON.stringify({ error: "Too many failed attempts. Locked for 10 minutes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const code = generateCode();
      const codeHash = await sha256Hex(code);
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

      // Invalidate prior unconsumed codes
      await adminClient
        .from("admin_2fa_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("consumed_at", null);

      // Insert one row per channel (same code)
      await adminClient.from("admin_2fa_codes").insert([
        { user_id: user.id, code_hash: codeHash, channel: "sms", expires_at: expiresAt },
        { user_id: user.id, code_hash: codeHash, channel: "email", expires_at: expiresAt },
      ]);

      // Send SMS via MSG91 Flow API (matches send-otp's working pattern)
      const msg91Key = Deno.env.get("MSG91_AUTH_KEY");
      const otpTemplate = Deno.env.get("MSG91_OTP_TEMPLATE_ID");
      let smsOk = false;
      let smsError: string | null = null;
      if (msg91Key && otpTemplate) {
        try {
          const phoneDigits = config.phone.replace(/^\+/, "");
          const smsRes = await fetch("https://control.msg91.com/api/v5/flow", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              authkey: msg91Key,
              accept: "application/json",
            },
            body: JSON.stringify({
              template_id: otpTemplate,
              recipients: [{ mobiles: phoneDigits, var1: code }],
            }),
          });
          const smsJson = await smsRes.json().catch(() => ({} as any));
          smsOk = smsRes.ok && (smsJson?.type === "success" || smsJson?.message === "Request accepted" || !!smsJson?.request_id);
          if (!smsOk) {
            smsError = `MSG91 ${smsRes.status}: ${JSON.stringify(smsJson).slice(0, 200)}`;
            console.error("admin-2fa SMS failed:", smsError);
          }
        } catch (e) {
          smsError = `SMS exception: ${(e as Error).message}`;
          console.error("admin-2fa SMS exception:", e);
        }
      } else {
        smsError = "MSG91 not configured";
      }

      // Send Email via send-transactional-email
      let emailOk = false;
      let emailError: string | null = null;
      try {
        const emailRes = await adminClient.functions.invoke("send-transactional-email", {
          body: {
            templateName: "admin-2fa-code",
            recipientEmail: config.email,
            idempotencyKey: `admin-2fa-${user.id}-${Date.now()}`,
            templateData: { code, expiresInMinutes: 5 },
          },
        });
        if (emailRes.error) {
          emailError = `Email invoke error: ${emailRes.error.message || JSON.stringify(emailRes.error).slice(0, 200)}`;
          console.error("admin-2fa email failed:", emailError);
        } else if ((emailRes.data as any)?.error) {
          emailError = `Email API error: ${JSON.stringify((emailRes.data as any).error).slice(0, 200)}`;
          console.error("admin-2fa email failed:", emailError);
        } else {
          emailOk = true;
        }
      } catch (e) {
        emailError = `Email exception: ${(e as Error).message}`;
        console.error("admin-2fa email exception:", e);
      }

      await logAudit(adminClient, user.id, "2fa_sent", req, {
        sms: smsOk, email: emailOk,
        smsError: smsError || undefined,
        emailError: emailError || undefined,
      });

      // Honest reporting: if BOTH channels failed, return 502
      if (!smsOk && !emailOk) {
        return new Response(JSON.stringify({
          error: "Could not deliver code via SMS or email",
          smsError, emailError,
        }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true, sms: smsOk, email: emailOk,
        smsError: smsOk ? undefined : smsError,
        emailError: emailOk ? undefined : emailError,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { code } = body;
      if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
        return new Response(JSON.stringify({ error: "Invalid code format" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const codeHash = await sha256Hex(code);
      const { data: matches } = await adminClient
        .from("admin_2fa_codes")
        .select("*")
        .eq("user_id", user.id)
        .eq("code_hash", codeHash)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .limit(1);

      if (!matches || matches.length === 0) {
        await logAudit(adminClient, user.id, "2fa_failed", req);
        return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Consume all rows for this user (both channels share the same hash)
      await adminClient
        .from("admin_2fa_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("consumed_at", null);

      // Issue step-up token
      const token = randomToken(32);
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + STEP_UP_TTL_MS).toISOString();

      await adminClient.from("admin_step_up_tokens").insert({
        user_id: user.id, token_hash: tokenHash, expires_at: expiresAt,
      });

      await logAudit(adminClient, user.id, "2fa_verified", req);

      return new Response(JSON.stringify({ success: true, token, expires_at: expiresAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "validate") {
      const { token } = body;
      if (!token || typeof token !== "string") {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenHash = await sha256Hex(token);
      const { data: row } = await adminClient
        .from("admin_step_up_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!row) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sliding window: extend expiry
      const newExpires = new Date(Date.now() + STEP_UP_TTL_MS).toISOString();
      await adminClient
        .from("admin_step_up_tokens")
        .update({ expires_at: newExpires, last_used_at: new Date().toISOString() })
        .eq("id", row.id);

      await logAudit(adminClient, user.id, "admin_route_access", req);

      return new Response(JSON.stringify({ success: true, expires_at: newExpires }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
