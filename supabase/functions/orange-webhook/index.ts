import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, api_key, x-api-key",
};

async function sha256Prefix(value: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(buf))
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "err";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get("ORANGE_WEBHOOK_SECRET");
    if (!secret) {
      console.error("Server configuration error: ORANGE_WEBHOOK_SECRET is not set");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect any header that could plausibly carry the shared secret.
    const rawAuth = req.headers.get("authorization") ?? "";
    const bearerAuth = rawAuth.toLowerCase().startsWith("bearer ")
      ? rawAuth.slice(7).trim()
      : "";
    const plainAuth = rawAuth && !bearerAuth ? rawAuth.trim() : "";

    const candidates: Array<{ source: string; value: string }> = [
      { source: "authorization:bearer", value: bearerAuth },
      { source: "authorization:raw", value: plainAuth },
      { source: "api_key", value: req.headers.get("api_key") ?? "" },
      { source: "apikey", value: req.headers.get("apikey") ?? "" },
      { source: "x-api-key", value: req.headers.get("x-api-key") ?? "" },
    ].filter((c) => c.value.length > 0);

    const matched = candidates.find((c) => c.value === secret);

    if (!matched) {
      const secretHash = await sha256Prefix(secret);
      const diag = await Promise.all(
        candidates.map(async (c) => ({
          source: c.source,
          length: c.value.length,
          hashPrefix: await sha256Prefix(c.value),
        })),
      );
      console.error("Unauthorized request attempt", {
        headerNames: Array.from(req.headers.keys()),
        candidates: diag,
        expectedLength: secret.length,
        expectedHashPrefix: secretHash,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log(
      `Received Orange Health Webhook via ${matched.source}:`,
      JSON.stringify(body, null, 2),
    );

    return new Response(
      JSON.stringify({ success: true, message: "Webhook received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
