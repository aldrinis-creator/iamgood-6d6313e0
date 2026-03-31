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
    if (!authKey) {
      console.error("MSG91_AUTH_KEY not configured");
      return new Response(
        JSON.stringify({ error: "MSG91 not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { template_id, recipients, short_url } = await req.json();

    if (!template_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "template_id and recipients[] are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MSG91 Flow API payload
    const payload: Record<string, unknown> = {
      template_id,
      short_url: short_url || "0",
      recipients,
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
    console.log("MSG91 Flow response:", JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: res.ok, result }),
      { status: res.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("MSG91 send error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
