import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedKeys: any = null;
let keysExpiry = 0;

async function getGooglePublicKeys() {
  if (cachedKeys && Date.now() < keysExpiry) {
    return cachedKeys;
  }
  const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  cachedKeys = await res.json();
  // Cache for 1 hour (or based on cache-control headers, but 1h is safe)
  keysExpiry = Date.now() + 3600 * 1000;
  return cachedKeys;
}

async function verifyFirebaseToken(idToken: string, projectId: string) {
  try {
    const keys = await getGooglePublicKeys();
    const { header } = jose.decodeProtectedHeader(idToken);
    
    if (!header.kid || !keys[header.kid]) {
      throw new Error("Invalid Firebase token signature");
    }

    const cert = keys[header.kid];
    const publicKey = await jose.importX509(cert, "RS256");

    const { payload } = await jose.jwtVerify(idToken, publicKey, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    return payload; // Contains phone_number
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
    const { idToken } = await req.json();
    const projectId = "check-in-6b822"; // Hardcoded for security

    if (!idToken || typeof idToken !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid idToken" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 1. Verify the Firebase token
    const decodedToken = await verifyFirebaseToken(idToken, projectId);
    if (!decodedToken || !decodedToken.phone_number) {
      return new Response(JSON.stringify({ error: "Invalid token or missing phone number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const phone = decodedToken.phone_number as string;
    
    // 2. Initialize Supabase Admin Client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Find or create the user in Supabase Auth
    // Firebase already verified them, so we can trust the phone number.
    // We use a dummy email to avoid Twilio requirements in Supabase.
    const email = `${phone.replace('+', '')}@phone.checkin.app`;
    
    // Attempt to create the user. If they already exist, it will fail safely.
    const { error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      phone,
      email_confirm: true,
      phone_confirm: true,
      password: crypto.randomUUID(), // Random secure password
    });

    // We don't throw on createError because it usually just means the user already exists
    // (e.g., error.message includes "User already registered")

    // 4. Generate a magiclink to get a token_hash
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (linkError) throw linkError;

    // Extract the token_hash from the generated link URL
    // Format: https://yoursite.com/auth/v1/verify?token=xxx&type=magiclink&redirect_to=...
    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get("token");

    if (!token_hash) {
      throw new Error("Could not extract token_hash from generated link");
    }

    // Return the token hash so the client can log in
    return new Response(
      JSON.stringify({
        success: true,
        token_hash,
        email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing firebase auth:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
