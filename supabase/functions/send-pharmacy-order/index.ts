const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow";

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

    // MSG91 returns HTTP 200 even for failures — must inspect body.type === "success"
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

    const requestId = typeof r === "object" && r !== null ? (r as any).message : null;

    return new Response(
      JSON.stringify({ success: true, request_id: requestId, result }),
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
