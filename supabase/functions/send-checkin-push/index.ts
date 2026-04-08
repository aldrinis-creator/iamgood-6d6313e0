import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64urlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidKeys(publicKeyBase64url: string, privateKeyBase64url: string) {
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);
  const publicKeyBytes = base64urlToBytes(publicKeyBase64url);
  return await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC", crv: "P-256",
      x: bytesToBase64url(publicKeyBytes.slice(1, 33)),
      y: bytesToBase64url(publicKeyBytes.slice(33, 65)),
      d: bytesToBase64url(privateKeyBytes),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function createJWT(vapidPrivateKey: CryptoKey, audience: string, subject: string) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };
  const headerB64 = bytesToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = bytesToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    vapidPrivateKey,
    new TextEncoder().encode(unsigned)
  );
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes[0] === 0x30) {
    const rLen = sigBytes[3];
    const rStart = 4;
    r = sigBytes.slice(rStart, rStart + rLen);
    const sLen = sigBytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    s = sigBytes.slice(sStart, sStart + sLen);
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
    if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
  } else {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  }
  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);
  return `${unsigned}.${bytesToBase64url(rawSig)}`;
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
) {
  const privateKey = await importVapidKeys(vapidPublicKey, vapidPrivateKey);
  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const jwt = await createJWT(privateKey, audience, vapidSubject);
  const body = JSON.stringify(payload);
  return await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = "BJq2e6gs1zTIdmNLo6v4DWL4trzwEedK_ghxuB9wb63nlh_y1ShYf2RS_IKdDdPu59tQJ3pLk5XHed6pGZ141lw";
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const VAPID_SUBJECT = "mailto:admin@checkin.app";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);

    // Find pending check-ins due within the next 5 minutes
    const { data: checkIns, error: ciErr } = await supabase
      .from("check_ins")
      .select("id, user_id, scheduled_at")
      .eq("status", "pending")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", fiveMinLater.toISOString());

    if (ciErr) {
      console.error("Error fetching check-ins:", ciErr);
      return new Response(JSON.stringify({ error: ciErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkIns || checkIns.length === 0) {
      return new Response(JSON.stringify({ message: "No check-ins due", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique user IDs
    const userIds = [...new Set(checkIns.map((ci: any) => ci.user_id))];
    let sentCount = 0;

    for (const userId of userIds) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) continue;

      const payload = {
        title: "✅ Check-iN Reminder",
        body: "Time to check in! Let your guardians know you're okay.",
        tag: `checkin-${now.getHours()}`,
        url: "/dashboard",
        type: "checkin",
        user_id: userId,
      };

      for (const sub of subs) {
        try {
          const res = await sendPushNotification(sub, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT);
          if (res.status === 201 || res.status === 200) {
            sentCount++;
          } else if (res.status === 410 || res.status === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          } else {
            console.error(`Push failed: ${res.status} ${await res.text()}`);
          }
        } catch (err) {
          console.error("Push error:", err);
        }
      }
    }

    return new Response(JSON.stringify({ message: "Done", sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
