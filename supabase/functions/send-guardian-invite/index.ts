import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate, normalizeIndianPhone, WA_NAMESPACE_V2 } from "../_shared/msg91Whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = !!cronSecret && cronSecret === Deno.env.get("CRON_SECRET");
    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const _userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: _u, error: _e } = await _userClient.auth.getUser();
      if (_e || !_u?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    const { guardian_email, guardian_name, guardian_phone, user_name, relation, nomination_token, accept_link, reminder_number } = await req.json();


    if (!guardian_name || !user_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate-limit re-sends: at most one invite dispatch per recipient per hour.
    // NOTE: this is tracked in notification_logs, NOT on guardians.nominated_at —
    // a freshly-nominated guardian always has a recent nominated_at, which used to
    // rate-limit the very first invite and silently drop it.
    const recipientKey = (guardian_email || guardian_phone || "").toString().toLowerCase();
    if (recipientKey) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentSends } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("type", "guardian_invite")
        .eq("channel", recipientKey)
        .gte("created_at", oneHourAgo)
        .limit(1);
      if (recentSends && recentSends.length > 0) {
        return new Response(
          JSON.stringify({ message: "Invite already sent recently. Please wait before re-sending.", rate_limited: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const relationText = relation ? ` (${relation})` : "";
    const baseUrl = "https://iamgood.lovable.app";
    const acceptLink = nomination_token
      ? `${baseUrl}/register?nomination=accept&token=${nomination_token}`
      : (accept_link || `${baseUrl}/register`);
    const rejectLink = nomination_token ? `${baseUrl}/register?nomination=reject&token=${nomination_token}` : "";
    // Install-first link: the install page explains how to add the app, then
    // hands the guardian straight to the accept flow with the same token.
    const installLink = nomination_token
      ? `${baseUrl}/install?g=${nomination_token}`
      : `${baseUrl}/install`;
    const reminderNumber = Number(reminder_number) || 0;
    const result: { email: string; sms: string; whatsapp: string; rate_limited: boolean; email_error?: string } = {
      email: "skipped",
      sms: "skipped",
      whatsapp: "skipped",
      rate_limited: false,
    };

    // WhatsApp: approved "download the Guardian app" template (no variables).
    if (guardian_phone) {
      const digitsOnly = String(guardian_phone).replace(/[^\d]/g, "");
      const waTo = normalizeIndianPhone(guardian_phone) ?? (digitsOnly.length >= 10 ? digitsOnly : null);
      if (waTo) {
        try {
          const wa = await sendWhatsAppTemplate({
            templateName: "guardian_invite_app_downlaod",
            languageCode: "en",
            namespace: WA_NAMESPACE_V2,
            recipients: [{
              to: [waTo],
              components: {
                body_1: String(guardian_name),
                body_2: String(user_name),
                body_3: (relation && String(relation).trim()) || "Guardian",
                body_4: installLink,
              },
            }],
          });
          result.whatsapp = wa.ok ? "sent" : "failed";
        } catch (waErr) {
          result.whatsapp = "failed";
          console.error("[send-guardian-invite] WhatsApp template error:", waErr);
        }
      } else {
        result.whatsapp = "failed";
        console.error("[send-guardian-invite] could not normalise phone for WhatsApp:", guardian_phone);
      }
    }


    // Send email via transactional email queue.
    // Called over HTTP (not functions.invoke) so the real error body is visible in logs.
    if (guardian_email) {
      try {
        const mailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            templateName: "guardian-invitation",
            recipientEmail: guardian_email,
            idempotencyKey: `guardian-invite-${guardian_email}-${nomination_token || Date.now()}${reminderNumber ? `-r${reminderNumber}` : ""}`,
            templateData: {
              guardianName: guardian_name,
              userName: user_name,
              relation: relationText,
              acceptLink,
              rejectLink,
              installLink,
              reminderNumber,
            },
          }),
        });
        const mailBody = await mailRes.text();
        if (!mailRes.ok) {
          result.email = "failed";
          result.email_error = `${mailRes.status}: ${mailBody.slice(0, 300)}`;
          console.error("[send-guardian-invite] email send failed", mailRes.status, mailBody.slice(0, 600));
        } else {
          result.email = "sent";
          console.log("[send-guardian-invite] email queued for", guardian_email, mailBody.slice(0, 300));
        }
      } catch (emailErr) {
        result.email = "failed";
        result.email_error = String(emailErr);
        console.error("[send-guardian-invite] email queue error:", emailErr);
      }
    }


    // Send WhatsApp/SMS via MSG91 if phone provided
    if (guardian_phone) {
      const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
      const msg91InviteTemplate = Deno.env.get("MSG91_INVITE_TEMPLATE_ID");
      if (msg91AuthKey && msg91InviteTemplate) {
        // Respect an explicit country code; only bare 10-digit numbers default to India.
        const raw = String(guardian_phone).replace(/[\s\-()]/g, "");
        const digits = raw.replace(/[^\d]/g, "");
        const mobile = raw.startsWith("+")
          ? digits
          : digits.length === 10
            ? `91${digits}`
            : digits;
        try {
          const inviteRes = await fetch("https://control.msg91.com/api/v5/flow", {
            method: "POST",
            headers: { "Content-Type": "application/json", authkey: msg91AuthKey },
            body: JSON.stringify({
              template_id: msg91InviteTemplate,
              short_url: "1",
              recipients: [{
                mobiles: mobile,
                guardian_name,
                user_name,
                relation: relationText,
                // Install-first: the page explains how to add the Guardian app,
                // then continues to the accept flow with the same token.
                accept_link: installLink,
                install_link: installLink,
                reject_link: rejectLink || "",
              }],

            }),
          });
          const inviteBody = await inviteRes.text();
          console.log("[send-guardian-invite] MSG91 response", {
            mobile,
            status: inviteRes.status,
            ok: inviteRes.ok,
            templateId: msg91InviteTemplate,
            body: inviteBody.slice(0, 600),
          });
          result.sms = inviteRes.ok ? "sent" : "failed";
          if (!inviteRes.ok) {
            console.error("[send-guardian-invite] MSG91 returned non-OK status", inviteRes.status, inviteBody);
          }
        } catch (e) {
          result.sms = "failed";
          console.error("[send-guardian-invite] MSG91 invite error:", e);
        }
      } else {
        result.sms = "failed";
        // Fallback: log WhatsApp link
        const whatsappMsg = encodeURIComponent(
          `🛡️ *Guardian Nomination — Check-iN*\n\nHi ${guardian_name},\n\n*${user_name}*${relationText} has nominated you as their Guardian on Check-iN.\n\n📲 Install the Guardian app: ${installLink}\n✅ Accept: ${acceptLink}\n${rejectLink ? `❌ Reject: ${rejectLink}\n` : ""}\nCheck-iN — Personal Emergency Response System`
        );
        console.log(`WhatsApp link: https://wa.me/${guardian_phone.replace(/[^0-9]/g, "")}?text=${whatsappMsg}`);
      }
    }

    // Record the dispatch so re-sends are rate-limited (best-effort).
    if (recipientKey && (result.email === "sent" || result.sms === "sent" || result.whatsapp === "sent")) {
      try {
        await supabase.from("notification_logs").insert({
          type: "guardian_invite",
          channel: recipientKey,
          status: `${result.email}/${result.sms}`,
          metadata: { guardian_name, has_token: !!nomination_token },
        });
      } catch (logErr) {
        console.error("[send-guardian-invite] log insert failed:", logErr);
      }
    }

    return new Response(
      JSON.stringify({ sent: result.email === "sent" || result.sms === "sent" || result.whatsapp === "sent", ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
