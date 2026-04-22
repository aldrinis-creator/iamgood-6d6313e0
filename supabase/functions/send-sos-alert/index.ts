import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Web Push utilities ---

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Send emails via transactional email queue
    const allEmails = [...(guardian_emails || [])];
    if (doctor_email) allEmails.push(doctor_email);

    let emailsQueued = 0;
    for (const email of allEmails) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "sos-alert",
            recipientEmail: email,
            idempotencyKey: `sos-${user_id}-${Date.now()}-${email}`,
            templateData: {
              userName: user_name || "Check-iN User",
              message,
            },
          },
        });
        emailsQueued++;
      } catch (e) {
        console.error(`Email queue error for ${email}:`, e);
      }
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
      await supabase.rpc("insert_notifications_deduped", { p_notifications: notifRows });
    }

    // --- Push notifications to guardians ---
    let pushSent = 0;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (vapidPrivateKey && guardianRows?.length) {
      const guardianPhones = guardianRows.map((g: any) => g.guardian_phone).filter(Boolean);

      if (guardianPhones.length) {
        const { data: guardianProfiles } = await supabase
          .from("profiles")
          .select("id")
          .in("phone", guardianPhones);

        if (guardianProfiles?.length) {
          const profileIds = guardianProfiles.map((p: any) => p.id);

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
                  sub, pushPayload, VAPID_PUBLIC_KEY, vapidPrivateKey,
                  "mailto:checkin_support@futurewave.in"
                );
                if (res.status === 200 || res.status === 201) {
                  pushSent++;
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
        }
      }
    }

    // --- MSG91 WhatsApp Outbound Bulk API to guardians ---
    let msg91Sent = 0;
    const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
    const integratedNumber = Deno.env.get("MSG91_INTEGRATED_NUMBER") || "917045868482";
    const templateName = Deno.env.get("MSG91_SOS_TEMPLATE_NAME") || "sos_alert_notification";
    const namespaceRaw = Deno.env.get("MSG91_SOS_TEMPLATE_ID") || "";
    const namespace = !namespaceRaw || namespaceRaw.toLowerCase() === "null" ? null : namespaceRaw;
    const langCode = Deno.env.get("MSG91_SOS_LANG") || "en_US";

    if (msg91AuthKey && guardianRows?.length) {
      // body_2: IST timestamp
      const istNow = new Date().toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false,
        timeZone: "Asia/Kolkata",
      });
      const istTimestamp = `${istNow} IST`;

      // body_3: latest SOS location → Google Maps link
      let locationStr = "Location unavailable";
      try {
        const { data: sosRow } = await supabase
          .from("sos_events")
          .select("latitude, longitude")
          .eq("user_id", user_id)
          .order("triggered_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sosRow?.latitude != null && sosRow?.longitude != null) {
          locationStr = `https://maps.google.com/?q=${sosRow.latitude},${sosRow.longitude}`;
        }
      } catch (e) {
        console.error("[send-sos-alert] location fetch error:", e);
      }

      // body_4: compact health summary from health_profile
      let healthSummary = "See app for details";
      try {
        const { data: hp } = await supabase
          .from("health_profile")
          .select("blood_group, chronic_conditions, allergies")
          .eq("user_id", user_id)
          .maybeSingle();
        if (hp) {
          const parts: string[] = [];
          if (hp.blood_group) parts.push(`Blood: ${hp.blood_group}`);
          if (hp.chronic_conditions?.length) parts.push(`Conditions: ${hp.chronic_conditions.join(", ")}`);
          if (hp.allergies?.length) parts.push(`Allergies: ${hp.allergies.join(", ")}`);
          if (parts.length) healthSummary = parts.join(" | ").slice(0, 200);
        }
      } catch (e) {
        console.error("[send-sos-alert] health_profile fetch error:", e);
      }

      // Dedupe phones
      const seen = new Set<string>();
      const to_and_components = guardianRows
        .map((g: any) => {
          const raw = (g.guardian_phone || "").replace(/\D/g, "");
          if (!raw) return null;
          const mobile = raw.startsWith("91") ? raw : `91${raw}`;
          if (mobile.length < 11 || seen.has(mobile)) return null;
          seen.add(mobile);
          return {
            to: [mobile],
            components: {
              body_1: { type: "text", value: (user_name || "A Check-iN user").slice(0, 60) },
              body_2: { type: "text", value: istTimestamp },
              body_3: { type: "text", value: locationStr.slice(0, 200) },
              body_4: { type: "text", value: healthSummary },
            },
          };
        })
        .filter((x: any) => x !== null);

      if (to_and_components.length > 0) {
        const payload = {
          integrated_number: integratedNumber,
          content_type: "template",
          payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
              name: templateName,
              language: { code: langCode, policy: "deterministic" },
              namespace,
              to_and_components,
            },
          },
        };

        console.log("[send-sos-alert] calling MSG91 WA", {
          templateName, namespace, recipientCount: to_and_components.length,
        });

        try {
          const res = await fetch(
            "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", authkey: msg91AuthKey },
              body: JSON.stringify(payload),
            }
          );
          const rawText = await res.text();
          let result: any = rawText;
          try { result = JSON.parse(rawText); } catch { /* not JSON */ }
          console.log("[send-sos-alert] MSG91 WA response", {
            status: res.status, body: rawText.slice(0, 600),
          });
          const msgType = result?.type;
          const requestId = result?.request_id ?? result?.message ?? null;
          const isSuccess = res.ok && (msgType === "success" || (!!requestId && msgType !== "error"));
          if (isSuccess) msg91Sent = to_and_components.length;
        } catch (e) {
          console.error("[send-sos-alert] MSG91 WA send error:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: emailsQueued, pushSent, msg91Sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
