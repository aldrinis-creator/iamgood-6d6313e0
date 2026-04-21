const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MSG91 WhatsApp Outbound Bulk endpoint (the correct one for WA templates).
const MSG91_WA_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

// Defaults from the working curl the user shared.
const DEFAULT_INTEGRATED_NUMBER = "917045868482";
const DEFAULT_TEMPLATE_NAME = "medication_order_notification";
const DEFAULT_NAMESPACE = "e1e205a8_3b76_4c20_bde4_9f124a35c8c4";
const DEFAULT_LANG = "en_US";

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
  console.log("[send-pharmacy-order] request received", { method: req.method });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const integratedNumber =
      Deno.env.get("MSG91_INTEGRATED_NUMBER") || DEFAULT_INTEGRATED_NUMBER;
    const templateName =
      Deno.env.get("MSG91_PHARMACY_TEMPLATE_NAME") || DEFAULT_TEMPLATE_NAME;
    const namespace =
      Deno.env.get("MSG91_PHARMACY_TEMPLATE_ID") || DEFAULT_NAMESPACE;
    const langCode = Deno.env.get("MSG91_PHARMACY_LANG") || DEFAULT_LANG;

    console.log("[send-pharmacy-order] config", {
      hasAuth: !!authKey,
      integratedNumber,
      templateName,
      namespace,
      langCode,
    });

    if (!authKey) {
      console.error("[send-pharmacy-order] MSG91_AUTH_KEY missing");
      return new Response(
        JSON.stringify({ success: false, error: "MSG91 not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as PharmacyOrderRequest;
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

    const safeItems = (items_text || "").slice(0, 900);

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: templateName,
          language: { code: langCode, policy: "deterministic" },
          namespace,
          to_and_components: [
            {
              to: [mobile],
              components: {
                body_1: { type: "text", value: patient_name },
                body_2: { type: "text", value: doctor_name },
                body_3: { type: "text", value: hospital_name },
                body_4: { type: "text", value: order_date },
                body_5: { type: "text", value: safeItems },
              },
            },
          ],
        },
      },
    };

    console.log("[send-pharmacy-order] calling MSG91 WA", {
      mobile,
      templateName,
      namespace,
    });

    const res = await fetch(MSG91_WA_URL, {
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

    console.log("[send-pharmacy-order] MSG91 WA response", {
      status: res.status,
      body: rawText.slice(0, 600),
    });

    const obj = (typeof result === "object" && result !== null) ? (result as Record<string, unknown>) : null;
    const msgType = obj?.type as string | undefined;
    const requestId = obj?.request_id ?? obj?.message ?? null;
    const errorMsg = (obj?.message && msgType === "error")
      ? String(obj.message)
      : (obj?.error ? String(obj.error) : null);

    const isSuccess = res.ok && (msgType === "success" || (!!requestId && msgType !== "error"));

    if (!isSuccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg || `HTTP ${res.status}`,
          http_status: res.status,
          result,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        result,
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
