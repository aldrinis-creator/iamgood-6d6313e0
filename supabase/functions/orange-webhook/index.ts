import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-oh-signature, x-oh-event-id",
};

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  if (clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function fromBase64(b64: string): Uint8Array {
  try {
    const bin = atob(b64.trim());
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array();
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, payload: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get("ORANGE_WEBHOOK_SECRET");
    if (!secret) {
      console.error("ORANGE_WEBHOOK_SECRET not set");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = (req.headers.get("x-oh-signature") ?? "").trim();
    const eventId = req.headers.get("x-oh-event-id") ?? "";
    const rawBody = await req.text();

    if (!signature) {
      console.error("Missing x-oh-signature", {
        headerNames: Array.from(req.headers.keys()),
        eventId,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const macBuf = await hmacSha256(secret, rawBody);
    const macHex = toHex(macBuf);
    const macBytes = new Uint8Array(macBuf);

    // Try several signature encodings Orange might use.
    const providedHex = fromHex(signature);
    const providedB64 = fromBase64(signature);
    // Some vendors prefix with "sha256=" — strip and retry hex.
    const stripped = signature.replace(/^sha256=/i, "");
    const providedHexStripped = fromHex(stripped);
    const providedB64Stripped = fromBase64(stripped);

    const matched =
      timingSafeEqual(macBytes, providedHex) ||
      timingSafeEqual(macBytes, providedB64) ||
      timingSafeEqual(macBytes, providedHexStripped) ||
      timingSafeEqual(macBytes, providedB64Stripped) ||
      signature.toLowerCase() === macHex ||
      stripped.toLowerCase() === macHex;

    if (!matched) {
      console.error("Signature mismatch", {
        eventId,
        signatureLength: signature.length,
        signaturePrefix: signature.slice(0, 8),
        expectedHexPrefix: macHex.slice(0, 8),
        bodyLength: rawBody.length,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = rawBody;
    }

    console.log("Orange webhook verified", {
      eventId,
      body: parsed,
    });

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
