const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow";
const MSG91_REPORT_URL = "https://control.msg91.com/api/v5/report"; // /{request_id}/wa

interface PharmacyOrderRequest {
  pharmacy_phone: string;
  patient_name: string;
  doctor_name: string;
  hospital_name: string;
  order_date: string;
  items_text: string;
}

function normalizePhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

async function pollDeliveryStatus(requestId: string, authKey: string): Promise<{
  state: string;
  raw: unknown;
} | null> {
  // Try a few endpoint variants — MSG91's report URL pattern has changed over time.
  const candidates = [
    `${MSG91_REPORT_URL}/${requestId}/wa`,
    `${MSG91_REPORT_URL}/${requestId}`,
    `https://control.msg91.com/api/v5/wa/report/${requestId}`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: { authkey: authKey, accept: "application/json" } });
      const text = await r.text();
      let body: any = text;
      try { body = JSON.parse(text); } catch { /* not json */ }
      console.log("[send-pharmacy-order] poll", { url, status: r.status, body: text.slice(0, 400) });
      if (r.ok && typeof body === "object" && body) {
        // Try to extract a state field from common shapes
        const data = body.data || body.report || body;
        const state =
          data?.status ||
          data?.delivery_status ||
          data?.state ||
          (Array.isArray(data) && data[0]?.status) ||
          "unknown";
        return { state: String(state), raw: body };
      }
    } catch (e) {
      console.warn("[send-pharmacy-order] poll error", { url, err: String(e) });
    }
  }
  return null;
}

Deno.serve(async (req) => {
  console.log("[send-pharmacy-order] request received", { method: req.method, url: req.url });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const templateId = Deno.env.get("MSG91_PHARMACY_TEMPLATE_ID");

    console.log("[send-pharmacy-order] invoked", {
      hasAuth: !!authKey,
      hasTpl: !!templateId,
      tplPreview: templateId ? `${templateId.slice(0, 8)}…` : null,
    });

    if (!authKey || !templateId) {
      console.error("[send-pharmacy-order] MSG91 not configured");
      return new Response(
        JSON.stringify({ success: false, error: "MSG91 not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json() as PharmacyOrderRequest;
    const {
      pharmacy_phone,
      patient_name,
      doctor_name,
      hospital_name,
      order_date,
      items_text,
    } = body;

    if (!pharmacy_phone || !patient_name || !doctor_name || !hospital_name || !order_date || !items_text) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mobile = normalizePhone(pharmacy_phone);
    if (mobile.length < 11) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeItems = items_text.slice(0, 900);

    const payload = {
      template_id: templateId,
      short_url: "0",
      recipients: [
        {
          mobiles: mobile,
          patient_name,
          doctor_name,
          hospital_name,
          order_date,
          items_list: safeItems,
        },
      ],
    };

    console.log("[send-pharmacy-order] calling MSG91", { mobile, template_id: templateId });

    const res = await fetch(MSG91_FLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    let result: unknown = rawText;
    try { result = JSON.parse(rawText); } catch { /* not JSON */ }

    console.log("[send-pharmacy-order] MSG91 response", {
      status: res.status,
      body: rawText.slice(0, 500),
    });

    const r = result as Record<string, unknown> | string;
    const msgType = typeof r === "object" && r !== null ? (r as any).type : null;
    const isSuccess = res.ok && (msgType === "success" || (typeof r === "object" && (r as any).message && !msgType));

    if (!isSuccess) {
      const errMsg = (typeof r === "object" && r !== null && ((r as any).message || (r as any).error)) || `HTTP ${res.status}`;
      return new Response(
        JSON.stringify({ success: false, error: String(errMsg), result, http_status: res.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestId: string | null = typeof r === "object" && r !== null ? String((r as any).message ?? "") : null;

    // Poll MSG91 report API to get the actual WhatsApp delivery state.
    let deliveryState = "queued";
    let deliveryRaw: unknown = null;
    if (requestId) {
      // Wait briefly so MSG91 has time to record an initial state.
      await new Promise((r) => setTimeout(r, 2500));
      const poll = await pollDeliveryStatus(requestId, authKey);
      if (poll) {
        deliveryState = poll.state;
        deliveryRaw = poll.raw;
      }
    }

    // Treat known terminal failures as failure so the client can fall back to wa.me.
    const failedStates = ["failed", "rejected", "undelivered", "expired", "blocked", "invalid"];
    const ds = String(deliveryState).toLowerCase();
    const deliveryFailed = failedStates.some((s) => ds.includes(s));

    console.log("[send-pharmacy-order] delivery verdict", {
      requestId, deliveryState, deliveryFailed,
    });

    return new Response(
      JSON.stringify({
        success: !deliveryFailed,
        delivery_state: deliveryState,
        delivery_failed: deliveryFailed,
        request_id: requestId,
        result,
        delivery_report: deliveryRaw,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-pharmacy-order] uncaught error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
