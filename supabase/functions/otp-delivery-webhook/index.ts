import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const PayloadSchema = z.record(z.unknown());

function firstString(...values: unknown[]): string | null {
  return values.find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
}

function normalizeStatus(raw: string | null): string {
  const status = (raw || "unknown").toLowerCase();
  if (["delivered", "read", "success", "sent"].includes(status)) return status === "read" ? "read" : "delivered";
  if (["failed", "failure", "rejected", "undelivered", "expired"].includes(status)) return "failed";
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get("CRON_SECRET");
    const suppliedSecret = req.headers.get("x-webhook-secret");
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = PayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = parsed.data;
    console.log("[otp-delivery-webhook] Received:", JSON.stringify(payload));

    const nested = typeof payload.data === "object" && payload.data !== null ? payload.data as Record<string, unknown> : {};
    const requestId = firstString(payload.requestId, payload.request_id, nested.requestId, nested.request_id);
    const rawStatus = firstString(payload.status, payload.report_status, payload.event, nested.status, nested.report_status);
    const status = normalizeStatus(rawStatus);
    const failureReason = firstString(payload.failureReason, payload.failure_reason, payload.desc, payload.reason, nested.failureReason, nested.desc);
    const deliveryTime = firstString(payload.deliveryTime, payload.delivery_time, payload.sentTime, payload.timestamp, nested.deliveryTime);
    const telNum = firstString(payload.telNum, payload.mobile, payload.phone, payload.to, nested.telNum, nested.mobile);

    if (!requestId && !telNum) {
      console.log("[otp-delivery-webhook] No requestId or telNum, ignoring");
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Try to match by request_id first
    if (requestId) {
      const { error } = await admin
        .from("otp_events")
        .update({
          delivery_status: status || "unknown",
          failure_reason: failureReason,
          delivery_time: deliveryTime ? new Date(deliveryTime).toISOString() : new Date().toISOString(),
        })
        .eq("request_id", requestId)
        .is("delivery_status", null);

      if (error) {
        console.error("[otp-delivery-webhook] Update error:", error.message);
      } else {
        console.log(`[otp-delivery-webhook] Updated request_id=${requestId} status=${status}`);
      }
    }

    // Also insert a raw webhook log row for full traceability
    const phone = telNum ? telNum.replace(/^\+/, "") : "unknown";
    await admin.from("otp_events").insert({
      phone,
      action: "delivery_report",
      request_id: requestId || null,
      status: "webhook",
      delivery_status: status || "unknown",
      failure_reason: failureReason,
      delivery_time: deliveryTime ? new Date(deliveryTime).toISOString() : new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[otp-delivery-webhook] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
