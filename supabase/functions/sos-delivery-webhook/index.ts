import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// MSG91 delivery report webhook for SOS WhatsApp + SMS.
//
// Configure this URL in MSG91 dashboard (Webhooks):
//   https://magnrdegcegxdtgapyez.supabase.co/functions/v1/sos-delivery-webhook
//
// MSG91 sends payloads in different shapes depending on channel/format
// (JSON or form-encoded `data=[{...}]`). We accept both.

function parseStatus(raw: any): "delivered" | "failed" | "sent" | "unknown" {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("deliver")) return "delivered";
  if (s.includes("fail") || s.includes("reject") || s.includes("undeliver")) return "failed";
  if (s.includes("sent") || s.includes("submit") || s.includes("accept")) return "sent";
  return "unknown";
}

async function readPayload(req: Request): Promise<any> {
  const ct = req.headers.get("content-type") || "";
  const text = await req.text();
  if (!text) return {};
  // JSON
  if (ct.includes("application/json")) {
    try { return JSON.parse(text); } catch { /* fall through */ }
  }
  // Form-encoded: data=[{...}] or key=value pairs
  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text);
    const data = params.get("data");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? { data: parsed } : parsed;
      } catch { /* ignore */ }
    }
    const obj: Record<string, string> = {};
    params.forEach((v, k) => { obj[k] = v; });
    return obj;
  }
  // Last resort: try JSON
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await readPayload(req);
    console.log("[sos-delivery-webhook] received:", JSON.stringify(payload).slice(0, 1000));

    const events: any[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
      ? payload
      : [payload];

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let updated = 0;
    for (const ev of events) {
      const requestId =
        ev?.requestId || ev?.request_id || ev?.requestID || ev?.id || null;
      const recipient =
        ev?.recipient || ev?.mobile || ev?.telNum || ev?.to || null;
      const statusRaw =
        ev?.status || ev?.report_status || ev?.deliveryStatus || ev?.delivery_status;
      const failureReason =
        ev?.failureReason || ev?.failure_reason || ev?.desc || ev?.description || null;
      const deliveredAt =
        ev?.deliveryTime || ev?.delivered_at || ev?.sentTime || null;

      const normalized = parseStatus(statusRaw);
      if (!requestId && !recipient) continue;

      const update: Record<string, any> = {
        delivery_status: normalized === "unknown" ? (statusRaw ?? "unknown") : normalized,
      };
      if (normalized === "delivered") {
        update.delivered_at = deliveredAt ? new Date(deliveredAt).toISOString() : new Date().toISOString();
      } else if (normalized === "failed") {
        update.failed_at = new Date().toISOString();
        if (failureReason) update.failure_reason = String(failureReason).slice(0, 500);
      }

      let q = admin.from("sos_message_attempts").update(update);
      if (requestId) {
        q = q.eq("request_id", String(requestId));
      } else if (recipient) {
        // Match latest attempt for that phone if no request_id
        const phone = String(recipient).replace(/^\+/, "");
        q = q.eq("recipient_phone", phone);
      }

      const { error, count } = await q.select("id", { count: "exact", head: true });
      if (error) {
        console.error("[sos-delivery-webhook] update error:", error.message);
      } else {
        updated += count ?? 0;
      }
    }

    return new Response(JSON.stringify({ ok: true, updated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sos-delivery-webhook] fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
