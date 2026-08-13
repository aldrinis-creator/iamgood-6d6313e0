import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pinned server-side: never trust a client-supplied Firebase project id.
const FIREBASE_PROJECT_ID = "check-in-6b822";
const GOOGLE_KEYS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedKeys: Record<string, string> | null = null;
let cachedKeysAt = 0;
const KEYS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedKeys && now - cachedKeysAt < KEYS_TTL_MS) return cachedKeys;
  const res = await fetch(GOOGLE_KEYS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Google public keys: ${res.status}`);
  cachedKeys = await res.json();
  cachedKeysAt = now;
  return cachedKeys!;
}

async function verifyFirebaseToken(idToken: string) {
  try {
    let keys = await getGooglePublicKeys();
    const { header } = jose.decodeProtectedHeader(idToken);
    if (!header.kid) throw new Error("Missing kid in token header");

    if (!keys[header.kid]) {
      // Key rotation: force a refresh once before giving up.
      cachedKeys = null;
      keys = await getGooglePublicKeys();
      if (!keys[header.kid]) throw new Error("Invalid Firebase token signature");
    }

    const publicKey = await jose.importX509(keys[header.kid], "RS256");
    const { payload } = await jose.jwtVerify(idToken, publicKey, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return payload; // contains phone_number
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const idToken = body?.idToken;

    if (typeof idToken !== "string" || idToken.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing or invalid idToken" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const decodedToken = await verifyFirebaseToken(idToken.trim());
    if (!decodedToken || !decodedToken.phone_number) {
      return new Response(JSON.stringify({ error: "Invalid token or missing phone number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const phone = decodedToken.phone_number as string;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Deterministic placeholder email keyed on the verified phone number.
    const email = `${phone.replace("+", "")}@phone.checkin.app`;

    // Create-if-absent. A duplicate error means the account already exists,
    // which is the normal returning-user path — no paged listUsers scan needed.
    const { error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      phone,
      email_confirm: true,
      phone_confirm: true,
      password: crypto.randomUUID(),
    });

    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      const alreadyExists =
        msg.includes("already") || msg.includes("duplicate") || createError.status === 422;
      if (!alreadyExists) throw createError;
    }

    // Mint a magiclink and hand back the token_hash for the client to verify.
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError) throw linkError;

    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get("token");
    if (!token_hash) throw new Error("Could not extract token_hash from generated link");

    return new Response(JSON.stringify({ success: true, token_hash, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing firebase auth:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal Server Error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
