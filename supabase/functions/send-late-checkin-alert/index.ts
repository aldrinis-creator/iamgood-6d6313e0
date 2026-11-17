import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate, normalizeIndianPhone, WA_NAMESPACE_V2 } from "../_shared/msg91Whatsapp.ts";
import { sendSmsFlow } from "../_shared/msg91Sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Approved MSG91 SMS Flow Template ID for late check-in
const SMS_TEMPLATE_ID = "6ae727cb5a7cc8f2bb0e9334";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing authorization", { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { checkInTime } = await req.json().catch(() => ({}));
    const safeTime =
      typeof checkInTime === "string" && /^\d{1,2}:\d{2}(\s?[AaPp][Mm])?$/.test(checkInTime.trim())
        ? checkInTime.trim()
        : null;
    // Format in IST so the server (UTC) never shows the wrong time.
    const formattedTime =
      safeTime ||
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });

    // Fetch Ward's profile name
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const wardName = profile?.full_name?.trim() || "Your ward";

    // Get active guardians.
    // NOTE: the column is `guardian_phone` (there is no `phone` column on `guardians`).
    const { data: guardians, error: guardiansError } = await serviceClient
      .from("guardians")
      .select("guardian_phone")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    if (guardiansError) {
      console.error("send-late-checkin-alert: failed to fetch guardians:", guardiansError);
      return new Response(JSON.stringify({ error: "Could not load guardians" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    if (!guardians || guardians.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No guardians to notify" }),
        { headers: jsonHeaders }
      );
    }

    // Normalize + dedupe so a guardian added twice only gets one message.
    const guardianPhones = Array.from(
      new Set(
        guardians
          .map((g: { guardian_phone: string | null }) => normalizeIndianPhone(g.guardian_phone))
          .filter((p): p is string => p !== null)
      )
    );

    if (guardianPhones.length === 0) {
      console.warn("send-late-checkin-alert: accepted guardians exist but none have a valid phone number");
      return new Response(
        JSON.stringify({ success: true, message: "No valid guardian phone numbers" }),
        { headers: jsonHeaders }
      );
    }

    // 1. Primary Channel: WhatsApp Template (ward_late_check_in_v2)
    // body_1: {#var1#} = Ward Name
    // body_2: {#var2#} = Time of Check-in
    const waResult = await sendWhatsAppTemplate({
      templateName: "ward_late_check_in_v2",
      languageCode: "en",
      namespace: WA_NAMESPACE_V2,
      recipients: [
        {
          to: guardianPhones,
          components: {
            body_1: wardName,
            body_2: formattedTime,
          },
        },
      ],
    });

    // Best-effort delivery log (never blocks the response).
    try {
      await serviceClient.from("notification_logs").insert({
        user_id: user.id,
        type: "late_checkin",
        channel: "whatsapp",
        status: waResult.ok ? "accepted" : "failed",
        metadata: {
          template: "ward_late_check_in_v2",
          recipients: guardianPhones,
          request_id: (waResult.body as any)?.data?.request_id ?? null,
          response: waResult.body,
        },
      });
    } catch (logErr) {
      console.error("send-late-checkin-alert: notification_logs insert failed:", logErr);
    }

    // 2. Fallback Channel: SMS Flow (Template ID: 6ae727cb5a7cc8f2bb0e9334)
    // Only when WhatsApp was not accepted, so guardians never get duplicates.
    if (!waResult.ok) {
      console.warn(
        "WhatsApp late check-in alert did not send, falling back to SMS, status:",
        waResult.status,
        JSON.stringify(waResult.body)
      );
      const sms = await sendSmsFlow({
        templateId: SMS_TEMPLATE_ID,
        recipients: guardianPhones.map((phone) => ({
          mobiles: phone,
          var1: wardName,
          var2: formattedTime,
        })),
      });

      try {
        await serviceClient.from("notification_logs").insert({
          user_id: user.id,
          type: "late_checkin",
          channel: "sms",
          status: sms.ok ? "accepted" : "failed",
          metadata: {
            template_id: SMS_TEMPLATE_ID,
            recipients: guardianPhones,
            request_id: sms.requestId ?? null,
            response: sms.body,
          },
        });
      } catch (logErr) {
        console.error("send-late-checkin-alert: sms log insert failed:", logErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, whatsapp_ok: waResult.ok }),
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("send-late-checkin-alert error:", error);
    return new Response(JSON.stringify({ error: "Could not send late check-in alert" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
