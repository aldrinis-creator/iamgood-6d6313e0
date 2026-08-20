// Shared MSG91 SMS helper (Flow API) for DLT-registered SMS templates.
//   https://control.msg91.com/api/v5/flow

const FLOW_URL = "https://control.msg91.com/api/v5/flow";

export type SmsRecipient = {
  /** E.164 digits WITHOUT leading '+' (e.g. "919876543210"). */
  mobiles: string;
  /** DLT flow variables, e.g. { var1: "Aldrin", var2: "7:00 AM" }. */
  [key: string]: string;
};

export async function sendSmsFlow(opts: {
  templateId: string;
  recipients: SmsRecipient[];
  shortUrl?: "0" | "1";
}): Promise<{ ok: boolean; status: number; requestId?: string; body: unknown }> {
  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  if (!authKey) {
    console.error("MSG91_AUTH_KEY missing — cannot send SMS");
    return { ok: false, status: 0, body: { error: "MSG91_AUTH_KEY missing" } };
  }
  if (!opts.templateId) {
    return { ok: false, status: 0, body: { error: "templateId missing" } };
  }
  const recipients = opts.recipients.filter((r) => !!r.mobiles);
  if (recipients.length === 0) {
    return { ok: true, status: 204, body: { skipped: "no recipients" } };
  }

  try {
    const res = await fetch(FLOW_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        template_id: opts.templateId,
        short_url: opts.shortUrl ?? "0",
        recipients,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const ok = res.ok && (body as any)?.type !== "error";
    const requestId = (body as any)?.message;
    if (!ok) {
      console.error(`MSG91 SMS ${opts.templateId} failed: ${res.status}`, JSON.stringify(body));
    } else {
      console.log(`MSG91 SMS ${opts.templateId} accepted (${recipients.length} recipient(s))`);
    }
    return { ok, status: res.status, requestId, body };
  } catch (err) {
    console.error(`MSG91 SMS ${opts.templateId} threw:`, err);
    return { ok: false, status: 0, body: { error: String(err) } };
  }
}
