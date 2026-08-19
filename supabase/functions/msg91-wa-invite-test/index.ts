// Diagnostic: sends the guardian app-download WhatsApp invite using the
// 3-body-variable + URL-button template shape and returns the raw MSG91 response.
import { sendWhatsAppTemplate, normalizeIndianPhone, WA_NAMESPACE_V2 } from "../_shared/msg91Whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Server-side only: requires the cron secret.
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizeIndianPhone(body.phone);
    if (!phone) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateName = String(body.template || "guardian_app_downlaod");
    const token = String(body.token || "test-token");

    const result = await sendWhatsAppTemplate({
      templateName,
      languageCode: String(body.language || "en"),
      namespace: WA_NAMESPACE_V2,
      recipients: [
        {
          to: [phone],
          components: {
            body_1: String(body.guardian_name || "Guardian"),
            body_2: String(body.user_name || "Your ward"),
            body_3: String(body.relation || "Guardian"),
            button_1_url: token,
          },
        },
      ],
    });

    return new Response(JSON.stringify({ phone, templateName, result }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
