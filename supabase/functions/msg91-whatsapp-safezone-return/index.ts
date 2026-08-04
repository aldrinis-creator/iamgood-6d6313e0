const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_WA_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";
const INTEGRATED_NUMBER = "917045868482";
const TEMPLATE_NAME = "safe_zone_return";
const NAMESPACE = "e67e5302_b6d0_403e_b3cc_8fa6e8accb01";

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) digits = "91" + digits;
  if (digits.startsWith("0") && digits.length === 11) digits = "91" + digits.slice(1);
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

function formatIST(iso: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";
  const fmt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return fmt.format(d) + " IST";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    if (!authKey) {
      console.error("MSG91_AUTH_KEY not configured");
      return new Response(JSON.stringify({ error: "MSG91 not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const wardName = String(body?.wardName ?? "").trim();
    const zoneName = String(body?.zoneName ?? "").trim();
    const occurredAt = String(body?.occurredAt ?? "");
    const phonesIn: unknown = body?.phones;

    if (!wardName || !zoneName || !Array.isArray(phonesIn) || phonesIn.length === 0) {
      return new Response(
        JSON.stringify({ error: "wardName, zoneName, phones[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phones = Array.from(
      new Set(
        (phonesIn as unknown[])
          .map((p) => normalizePhone(String(p ?? "")))
          .filter((p): p is string => !!p)
      )
    );

    if (phones.length === 0) {
      return new Response(JSON.stringify({ error: "No valid phones" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      integrated_number: INTEGRATED_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: TEMPLATE_NAME,
          language: { code: "en", policy: "deterministic" },
          namespace: NAMESPACE,
          to_and_components: [
            {
              to: phones,
              components: {
                body_1: { type: "text", value: wardName },
                body_2: { type: "text", value: zoneName },
              },
            },
          ],
        },
      },
    };

    const res = await fetch(MSG91_WA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }

    if (!res.ok) {
      console.error("MSG91 WhatsApp safe_zone_return failed", res.status, text);
    } else {
      console.log("MSG91 WhatsApp safe_zone_return sent to", phones.length, "recipients");
    }

    return new Response(
      JSON.stringify({ success: res.ok, status: res.status, result }),
      {
        status: res.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("msg91-whatsapp-safezone-return error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
