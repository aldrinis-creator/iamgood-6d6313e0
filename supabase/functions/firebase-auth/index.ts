import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as jose from "https://esm.sh/jose@4.14.4";

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
    const header = jose.decodeProtectedHeader(idToken);
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
  } catch (error: any) {
    console.error("Firebase token verification failed:", error);
    return { error: error.message || "Unknown JWT Error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const idToken = body?.idToken;

    if (typeof idToken !== "string" || idToken.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Missing or invalid idToken" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const decodedToken = await verifyFirebaseToken(idToken.trim());
    if (decodedToken && decodedToken.error) {
      return new Response(JSON.stringify({ success: false, error: `JWT Verification Failed: ${decodedToken.error}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!decodedToken || !decodedToken.phone_number) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token or missing phone number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const phone = decodedToken.phone_number as string;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Deterministic placeholder email keyed on the verified phone number.
    const email = `${phone.replace("+", "")}@phone.checkin.app`;

    // Attempt to create the user. If they already exist, it will fail safely.
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      phone,
      email_confirm: true,
      phone_confirm: true,
      password: crypto.randomUUID(), // Random secure password
    });

    if (createError && createError.message.includes("phone number")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "This phone number is already registered to another account (likely your email). Please log in with email instead." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 4. Generate a magiclink to get a token_hash
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (linkError) {
      console.error("Link Error", linkError);
      return new Response(JSON.stringify({ success: false, error: linkError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 5. Return the token_hash to the client
    return new Response(JSON.stringify({ 
      success: true, 
      token_hash: linkData.properties?.action_link?.match(/token=([^&]+)/)?.[1],
      email: email 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
