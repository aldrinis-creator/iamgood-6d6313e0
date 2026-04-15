import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const templateId = Deno.env.get("MSG91_APPT_SHARE_TEMPLATE_ID");

    if (!authKey || !templateId) {
      console.error("MSG91_AUTH_KEY or MSG91_APPT_SHARE_TEMPLATE_ID not configured");
      return new Response(
        JSON.stringify({ success: false, error: "MSG91 not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { appointment, recipients } = await req.json();

    if (!appointment || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "appointment and recipients[] are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const msg91Recipients = recipients.map((r: { phone: string; name: string }) => ({
      mobiles: r.phone.replace(/[^0-9]/g, ""),
      appointment_title: appointment.title || "Appointment",
      date: appointment.start_date || "",
      time: (appointment.start_time || "").slice(0, 5),
      location: appointment.location || "Not specified",
      doctor_name: appointment.doctor_name || "Not specified",
      member_name: r.name,
    }));

    const payload = {
      template_id: templateId,
      short_url: "0",
      recipients: msg91Recipients,
    };

    const res = await fetch(MSG91_FLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    console.log("MSG91 WhatsApp share response:", JSON.stringify(result));

    // Update share_status via service role
    if (res.ok) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      await supabase
        .from("appointments")
        .update({ share_status: "shared" })
        .eq("id", appointment.id);
    }

    return new Response(
      JSON.stringify({ success: res.ok, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Share appointment error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
