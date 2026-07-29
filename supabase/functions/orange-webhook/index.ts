import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, api_key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the webhook request
    // Allow either the standard Authorization: Bearer <secret> OR a custom api_key header
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    const apiKeyHeader = req.headers.get("api_key");
    const secret = Deno.env.get("ORANGE_WEBHOOK_SECRET");
    
    if (!secret) {
      console.error("Server configuration error: ORANGE_WEBHOOK_SECRET is not set");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (authHeader !== secret && apiKeyHeader !== secret) {
      console.error("Unauthorized request attempt");
      console.error("Headers received:", Object.fromEntries(req.headers.entries()));
      console.error(`Expected secret: ${secret ? 'Set' : 'NOT SET'}`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Parse the incoming payload
    const body = await req.json();
    console.log("Received Orange Health Webhook:", JSON.stringify(body, null, 2));

    // TODO: Wire this up to the `diagnostic_orders` or `service_requests` table when the schema is finalized
    // e.g., const { partnerReferenceId, status, alnumOrderId } = body;
    // await supabase.from('diagnostic_orders').update({ status }).eq('partner_reference_id', partnerReferenceId);

    // Return 200 OK so Orange Health knows we received it successfully
    return new Response(JSON.stringify({ success: true, message: "Webhook received" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
