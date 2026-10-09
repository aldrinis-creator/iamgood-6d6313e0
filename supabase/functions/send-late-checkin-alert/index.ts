import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate, normalizeIndianPhone, WA_NAMESPACE_V2 } from "../_shared/msg91Whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      .filter((p) => p !== null) as string[];

    if (guardianPhones.length > 0) {
      // Send template (no components needed since template has no variables)
      await sendWhatsAppTemplate({
        templateName: "ward_late_check_in",
        namespace: WA_NAMESPACE_V2,
        recipients: [
          {
            to: guardianPhones,
            components: {}
          },
        ],
      });
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