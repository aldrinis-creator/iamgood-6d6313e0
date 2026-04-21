const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Diagnostic: returns the registered MSG91 WhatsApp template definition so we
// can confirm the exact variable names the Flow expects.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const url = new URL(req.url);
    const templateId =
      url.searchParams.get("template_id") ||
      Deno.env.get("MSG91_PHARMACY_TEMPLATE_ID");

    if (!authKey || !templateId) {
      return new Response(
        JSON.stringify({ error: "Missing auth key or template id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try several known MSG91 endpoints — the WA template GET URL has varied.
    const candidates = [
      `https://control.msg91.com/api/v5/wa/template/${templateId}`,
      `https://control.msg91.com/api/v5/flow/${templateId}`,
      `https://control.msg91.com/api/v5/wa/templates/${templateId}`,
    ];

    const reports: unknown[] = [];
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { authkey: authKey, accept: "application/json" } });
        const text = await r.text();
        let body: unknown = text;
        try { body = JSON.parse(text); } catch { /* not json */ }
        reports.push({ url: u, status: r.status, body });
      } catch (e) {
        reports.push({ url: u, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ template_id: templateId, reports }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
