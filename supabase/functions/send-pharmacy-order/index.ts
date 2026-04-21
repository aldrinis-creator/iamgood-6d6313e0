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
  const digits = raw.replace(/\D/g, "");
  // MSG91 expects E.164 without '+'. Default to India (91) if 10 digits.
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const templateId = Deno.env.get("MSG91_PHARMACY_TEMPLATE_ID");

    if (!authKey || !templateId) {
      console.error("MSG91 not configured", { hasAuth: !!authKey, hasTpl: !!templateId });
      return new Response(
        JSON.stringify({ error: "MSG91 not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mobile = normalizePhone(pharmacy_phone);
    if (mobile.length < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cap items text length so it stays within WA template limits
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

    const res = await fetch(MSG91_FLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    console.log("MSG91 pharmacy order response:", JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: res.ok, result }),
      { status: res.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-pharmacy-order error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
