// Shared MSG91 WhatsApp helper for template-based outbound messages.
// Uses the bulk WhatsApp Outbound API:
//   https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/

const WA_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

const INTEGRATED_NUMBER = "917045868482";
const NAMESPACE = "e1e205a8_3b76_4c20_bde4_9f124a35c8c4";
/** Namespace for the newer template set (welcome, missed check-in/medication, safe zone). */
export const WA_NAMESPACE_V2 = "e67e5302_b6d0_403e_b3cc_8fa6e8accb01";

export type WaComponents = {
  body_1?: string;
  body_2?: string;
  body_3?: string;
  /** URL button variable (e.g. OTP code for copy-code button templates). */
  button_1_url?: string;
};

export type WaRecipient = {
  /** One or more E.164 numbers WITHOUT leading '+' (e.g. "919876543210"). */
  to: string[];
  components: WaComponents;
};

/** Normalize an arbitrary Indian phone string to "91XXXXXXXXXX" (digits only). */
export function normalizeIndianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  if (!d.startsWith("91") || d.length < 12) return null;
  return d;
}

export async function sendWhatsAppTemplate(opts: {
  templateName: string;
  languageCode: string; // e.g. "en_US" | "en_GB"
  /** Optional MSG91 namespace override (defaults to the legacy namespace). */
  namespace?: string;
  recipients: WaRecipient[];
}): Promise<{ ok: boolean; status: number; body: unknown }> {
  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  if (!authKey) {
    console.error("MSG91_AUTH_KEY missing — cannot send WhatsApp");
    return { ok: false, status: 0, body: { error: "MSG91_AUTH_KEY missing" } };
  }
  const cleanRecipients = opts.recipients
    .map((r) => ({ ...r, to: r.to.filter(Boolean) }))
    .filter((r) => r.to.length > 0);

  if (cleanRecipients.length === 0) {
    return { ok: true, status: 204, body: { skipped: "no recipients" } };
  }

  const componentsToObject = (c: WaComponents) => {
    const out: Record<string, any> = {};
    if (c.body_1 !== undefined) out.body_1 = { type: "text", value: c.body_1 };
    if (c.body_2 !== undefined) out.body_2 = { type: "text", value: c.body_2 };
    if (c.body_3 !== undefined) out.body_3 = { type: "text", value: c.body_3 };
    if (c.button_1_url !== undefined) out.button_1 = { subtype: "url", type: "text", value: c.button_1_url };
    return out;
  };

  const payload = {
    integrated_number: INTEGRATED_NUMBER,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: opts.templateName,
        language: { code: opts.languageCode, policy: "deterministic" },
        namespace: opts.namespace ?? NAMESPACE,
        to_and_components: cleanRecipients.map((r) => ({
          to: r.to,
          components: componentsToObject(r.components),
        })),
      },
    },
  };

  try {
    const res = await fetch(WA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(
        `MSG91 WA ${opts.templateName} failed: ${res.status}`,
        JSON.stringify(body),
      );
    } else {
      console.log(`MSG91 WA ${opts.templateName} ok (${cleanRecipients.length} recipient group(s))`);
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    console.error(`MSG91 WA ${opts.templateName} threw:`, err);
    return { ok: false, status: 0, body: { error: String(err) } };
  }
}
