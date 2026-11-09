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
    const formattedTime = checkInTime || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    // Fetch Ward's profile name
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const wardName = profile?.full_name?.trim() || "Your ward";

    // Get active guardians
    const { data: guardians } = await serviceClient
      .from("guardians")
      .select("phone")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    if (!guardians || guardians.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No guardians to notify" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const guardianPhones = guardians
      .map((g) => normalizeIndianPhone(g.phone))
      .filter((p): p is string => p !== null);

    if (guardianPhones.length > 0) {
      // 1. Primary Channel: WhatsApp Template (ward_late_check_in_v2)
      // body_1: {#var1#} = Ward Name
      // body_2: {#var2#} = Time of Check-in
      const waResult = await sendWhatsAppTemplate({
        templateName: "ward_late_check_in_v2",
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

      // 2. Fallback Channel: SMS Flow (Template ID: 6ae727cb5a7cc8f2bb0e9334)
      // If WhatsApp fails or is not delivered, dispatch SMS
      if (!waResult.ok) {
        console.warn("WhatsApp late check-in alert did not send, falling back to SMS:", waResult.error);
        await sendSmsFlow({
          templateId: SMS_TEMPLATE_ID,
          recipients: guardianPhones.map((phone) => ({
            mobiles: phone,
            var1: wardName,
            var2: formattedTime,
          })),
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("send-late-checkin-alert error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});