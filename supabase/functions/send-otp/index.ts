const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_BASE = "https://control.msg91.com/api/v5";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const templateId = Deno.env.get("MSG91_OTP_TEMPLATE_ID");

    if (!authKey || !templateId) {
      return new Response(
        JSON.stringify({ error: "MSG91 OTP not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, phone, otp } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure phone has country code
    const cleanPhone = phone.replace(/[\s-]/g, "");
    const formattedPhone = cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

    let url: string;
    let method = "POST";
    let body: string | undefined;

    if (action === "verify") {
      if (!otp) {
        return new Response(
          JSON.stringify({ error: "otp is required for verification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      url = `${MSG91_BASE}/otp/verify?otp=${otp}&mobile=${formattedPhone}`;
      method = "GET";
    } else if (action === "resend") {
      // Send a fresh OTP instead of retry (retry fails if original session expired)
      url = `${MSG91_BASE}/otp?template_id=${templateId}&mobile=${formattedPhone}`;
      method = "POST";
    } else {
      // Default: send OTP
      url = `${MSG91_BASE}/otp?template_id=${templateId}&mobile=${formattedPhone}`;
      method = "POST";
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authkey: authKey,
    };

    const res = await fetch(url, { method, headers, body });
    const result = await res.json();
    console.log(`MSG91 OTP ${action || "send"} response:`, JSON.stringify(result));

    const success = result.type === "success" || result.type === "otp_verified";

    return new Response(
      JSON.stringify({ success, result }),
      { status: success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("OTP error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
