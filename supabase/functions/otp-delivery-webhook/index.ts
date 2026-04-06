import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[otp-delivery-webhook] Received:", JSON.stringify(payload));

    const requestId = payload.requestId || payload.request_id;
    const status = payload.status || payload.report_status;
    const failureReason = payload.failureReason || payload.desc || null;
    const deliveryTime = payload.deliveryTime || payload.sentTime || null;
    const telNum = payload.telNum || payload.mobile || null;

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
