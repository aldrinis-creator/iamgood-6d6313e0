import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Web Push utilities (from send-medication-push) ---

const VAPID_PUBLIC_KEY = "BJq2e6gs1zTIdmNLo6v4DWL4trzwEedK_ghxuB9wb63nlh_y1ShYf2RS_IKdDdPu59tQJ3pLk5XHed6pGZ141lw";

function base64urlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidKeys(publicKeyBase64url: string, privateKeyBase64url: string) {
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);
  const publicKeyBytes = base64urlToBytes(publicKeyBase64url);

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64url(publicKeyBytes.slice(1, 33)),
      y: bytesToBase64url(publicKeyBytes.slice(33, 65)),
      d: bytesToBase64url(privateKeyBytes),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  return privateKey;
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
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body,
  });
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, message, guardian_emails, doctor_email, doctor_name, user_name } = await req.json();

    if (!user_id || !message) {
      return new Response(JSON.stringify({ error: "user_id and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Build HTML email
    const htmlMessage = message
      .replace(/\n/g, "<br>")
      .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb">$1</a>');

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:2px solid #dc2626">
        <div style="text-align:center;padding:16px;background:#dc2626;border-radius:8px;margin-bottom:16px">
          <h1 style="color:#fff;margin:0;font-size:24px">🚨 EMERGENCY SOS ALERT</h1>
        </div>
        <div style="padding:16px;font-size:15px;line-height:1.6;color:#1a1a1a">
          ${htmlMessage}
        </div>
        <div style="margin-top:16px;padding:12px;background:#fef2f2;border-radius:8px;text-align:center">
          <p style="margin:0;color:#dc2626;font-weight:bold">⚠️ This is an emergency alert. Please respond immediately.</p>
        </div>
      </div>
    `;

    const emailResults: any[] = [];

    // Send emails (only if Resend is configured)
    if (resendKey) {
      const allEmails = [...(guardian_emails || [])];
      if (doctor_email) allEmails.push(doctor_email);

      for (const email of allEmails) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "Check-iN SOS <onboarding@resend.dev>",
              to: [email],
              subject: `🚨 EMERGENCY SOS from ${user_name || "Check-iN User"}`,
              html: emailHtml,
            }),
          });
          const result = await res.json();
          emailResults.push({ email, success: res.ok, result });
        } catch (e) {
          emailResults.push({ email, success: false, error: String(e) });
        }
      }
    } else {
      console.error("RESEND_API_KEY not configured, skipping emails");
    }

    // Create DB notifications for guardians
    const { data: guardianRows } = await supabase
      .from("guardians")
      .select("id, guardian_phone")
      .eq("user_id", user_id);

    if (guardianRows?.length) {
      const notifRows = guardianRows.map((g: any) => ({
        user_id,
        guardian_id: g.id,
        title: "🚨 SOS Alert Triggered",
        message: `Emergency SOS alert from ${user_name || "User"}. Check email and WhatsApp for details.`,
        type: "sos_alert",
      }));
      await supabase.from("notifications").insert(notifRows);
    }

    // --- Push notifications to guardians ---
    let pushSent = 0;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (vapidPrivateKey && guardianRows?.length) {
      const guardianPhones = guardianRows.map((g: any) => g.guardian_phone).filter(Boolean);

      if (guardianPhones.length) {
        // Look up profile IDs by phone
        const { data: guardianProfiles } = await supabase
          .from("profiles")
          .select("id")
          .in("phone", guardianPhones);

        if (guardianProfiles?.length) {
          const profileIds = guardianProfiles.map((p: any) => p.id);

          // Get push subscriptions for those profiles
          const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .in("user_id", profileIds);

          if (subs?.length) {
            const pushPayload = {
              title: "🚨 EMERGENCY SOS",
              body: `Emergency SOS from ${user_name || "a Check-iN user"}! Open app immediately.`,
              tag: "sos-alert",
              url: "/guardian",
            };

            for (const sub of subs) {
              try {
                const res = await sendPushNotification(
                  sub,
                  pushPayload,
                  VAPID_PUBLIC_KEY,
                  vapidPrivateKey,
                  "mailto:admin@checkin.app"
                );
                if (res.status === 200 || res.status === 201) {
                  pushSent++;
                } else if (res.status === 410 || res.status === 404) {
                  await supabase
                    .from("push_subscriptions")
                    .delete()
                    .eq("endpoint", sub.endpoint);
                } else {
                  console.error(`Push failed: ${res.status} ${await res.text()}`);
                }
              } catch (err) {
                console.error("Push error:", err);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: emailResults.length, results: emailResults, pushSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
