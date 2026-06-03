const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// DEPRECATED: The 4-hour consolidated SMS batch has been replaced by single
// WhatsApp alerts fired by `check-missed-checkins` (T+60m) and
// `check-missed-medications` (T+60m). This function is intentionally a no-op
// so the existing pg_cron entry can stay scheduled without sending duplicates.
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      disabled: true,
      message:
        "send-consolidated-alerts is deprecated. Missed-event WhatsApp alerts are now handled by check-missed-checkins and check-missed-medications.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
