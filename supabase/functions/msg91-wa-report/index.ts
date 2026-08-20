// Diagnostic: pulls MSG91 WhatsApp delivery reports for a given request_id.
// MSG91's WA report endpoint has moved a few times, so we probe the known
// candidates and return every raw response for inspection.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    if (!authKey) {
      return new Response(JSON.stringify({ error: "MSG91_AUTH_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body.request_id || "").trim();
    const integratedNumber = String(body.integrated_number || "917045868482");

    const getCandidates: string[] = [
      // Approved template list for this WABA number — tells us the exact
      // component shape (body vars vs URL button) MSG91 has on file.
      `https://control.msg91.com/api/v5/whatsapp/whatsapp-template/?integrated_number=${integratedNumber}`,
      `https://control.msg91.com/api/v5/whatsapp/get-template/?integrated_number=${integratedNumber}`,
      `https://control.msg91.com/api/v5/whatsapp/getTemplates?integrated_number=${integratedNumber}`,
      `https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/template/?integrated_number=${integratedNumber}`,
      `https://control.msg91.com/api/v5/whatsapp/template/?integrated_number=${integratedNumber}`,
      `https://control.msg91.com/api/v5/whatsapp/templates?integrated_number=${integratedNumber}`,
      `https://api.msg91.com/api/v5/whatsapp/whatsapp-template/?integrated_number=${integratedNumber}`,
      `https://control.msg91.com/api/v5/whatsapp/whatsapp-template/list?integrated_number=${integratedNumber}`,
    ];


    const reports: unknown[] = [];
    for (const url of getCandidates) {
      try {
        const r = await fetch(url, { headers: { authkey: authKey, accept: "application/json" } });
        const text = await r.text();
        let parsed: unknown = text.slice(0, 4000);
        try { parsed = JSON.parse(text); } catch { /* keep text */ }
        reports.push({ method: "GET", url, status: r.status, body: parsed });
      } catch (e) {
        reports.push({ method: "GET", url, error: String(e) });
      }
    }

    // Delivery logs (POST) for the last 48h on this WABA number.
    const today = new Date();
    const from = new Date(today.getTime() - 48 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const postCandidates: { url: string; payload: Record<string, unknown> }[] = [
      {
        url: "https://control.msg91.com/api/v5/report/logs/p/wa",
        payload: {
          format: "json",
          page: 1,
          pageSize: 50,
          startDate: fmt(from),
          endDate: fmt(today),
          ...(requestId ? { requestId } : {}),
        },
      },
      {
        url: "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/report/bulk/",
        payload: { integrated_number: integratedNumber, request_id: requestId || undefined },
      },
    ];


    for (const c of postCandidates) {
      try {
        const r = await fetch(c.url, {
          method: "POST",
          headers: { authkey: authKey, "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify(c.payload),
        });
        const text = await r.text();
        let parsed: unknown = text.slice(0, 2000);
        try { parsed = JSON.parse(text); } catch { /* keep text */ }
        reports.push({ method: "POST", url: c.url, status: r.status, body: parsed });
      } catch (e) {
        reports.push({ method: "POST", url: c.url, error: String(e) });
      }
    }

    // Compact summary of the logs endpoint rows (easier to read than raw).
    let summary: unknown[] = [];
    for (const rep of reports as any[]) {
      const rows = rep?.body?.data;
      if (Array.isArray(rows)) {
        summary = rows.map((d: any) => ({
          template: d.templateName,
          to: d.customerNumber,
          status: d.status,
          failureReason: d.failureReason,
          at: d.requestedAt,
          requestId: d.requestId,
        }));
      }
    }

    return new Response(JSON.stringify({ request_id: requestId, summary, reports: body.raw ? reports : undefined }, null, 2), {
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
