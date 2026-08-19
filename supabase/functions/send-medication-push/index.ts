import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push utilities using Web Crypto API
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

  // Convert DER signature to raw r||s
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;

  if (sigBytes[0] === 0x30) {
    // DER format
    const rLen = sigBytes[3];
    const rStart = 4;
    r = sigBytes.slice(rStart, rStart + rLen);
    const sLen = sigBytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    s = sigBytes.slice(sStart, sStart + sLen);

    // Pad/trim to 32 bytes
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
    if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
  } else {
    // Already raw
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
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body,
  });

  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = "BJq2e6gs1zTIdmNLo6v4DWL4trzwEedK_ghxuB9wb63nlh_y1ShYf2RS_IKdDdPu59tQJ3pLk5XHed6pGZ141lw";
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const VAPID_SUBJECT = "mailto:checkin_support@futurewave.in";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth gate: only allow cron callers (service-role bearer or shared cron secret)
    const authHeader = req.headers.get("Authorization") || "";
    const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
    const isCron =
      authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` ||
      (!!CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET);
    if (!isCron) {
      console.error("[send-medication-push] AUTH REJECTED: caller is not the cron job");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, "0");
    const currentMinute = String(now.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    // Build a ±2 minute window of valid schedule times
    const validTimes: string[] = [];
    for (let offset = -2; offset <= 2; offset++) {
      const d = new Date(now.getTime() + offset * 60000);
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      validTimes.push(`${h}:${m}`);
    }

    // Get all medications with alarms enabled
    const { data: medications, error: medErr } = await supabase
      .from("medications")
      .select("id, user_id, name, dosage, schedule_times, schedule_days, alarm_enabled")
      .eq("alarm_enabled", true);

    if (medErr) {
      console.error("Error fetching medications:", medErr);
      return new Response(JSON.stringify({ error: medErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch today's logs to check if already taken
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const { data: logs } = await supabase
      .from("medication_logs")
      .select("medication_id, scheduled_at, status")
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .in("status", ["taken", "taken_late"]);

    // Filter medications that have any schedule_time within our ±2min window
    // AND have not been taken yet for that specific schedule_time.
    const matchingMeds = (medications || []).filter((med: any) => {
      if (!med.schedule_times || !Array.isArray(med.schedule_times)) return false;
      const istWeekday = Number(new Date().toLocaleString("en-US", { weekday: "numeric" as any, timeZone: "Asia/Kolkata" })) || new Date(new Date().getTime() + 5.5 * 3600000).getUTCDay();
      if (Array.isArray(med.schedule_days) && med.schedule_days.length > 0 && !med.schedule_days.map(Number).includes(istWeekday)) return false;
      return med.schedule_times.some((t: string) => {
        if (!validTimes.includes(t)) return false;
        
        // Check if there is already a 'taken' log for this specific time slot today
        const [h, m] = t.split(":").map(Number);
        const alreadyTaken = (logs || []).some((log: any) => {
          if (log.medication_id !== med.id) return false;
          const logDate = new Date(log.scheduled_at);
          return logDate.getHours() === h && logDate.getMinutes() === (m || 0);
        });
        
        return !alreadyTaken;
      });
    });

    if (matchingMeds.length === 0) {
      return new Response(JSON.stringify({ message: "No pending medications due", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user
    const userMeds = new Map<string, Array<{ name: string; id: string; scheduled_time: string }>>();
    for (const med of matchingMeds) {
      // Find which valid time matched this medication
      const matchedTime = med.schedule_times.find((t: string) => validTimes.includes(t)) || currentTimeStr;
      
      const list = userMeds.get(med.user_id) || [];
      list.push({ name: med.name, id: med.id, scheduled_time: matchedTime });
      userMeds.set(med.user_id, list);
    }

    let sentCount = 0;


    for (const [userId, meds] of userMeds) {
      // Get push subscriptions for this user
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) continue;

      const matchedTime = meds[0].scheduled_time; // Format: "HH:MM"
      const [h, m] = matchedTime.split(":").map(Number);
      const scheduleDate = new Date(now);
      scheduleDate.setHours(h, m || 0, 0, 0);

      const medNames = meds.map(m => m.name);
      const payload = {
        title: "💊 Medication Reminder",
        body: medNames.length === 1
          ? `Time to take ${medNames[0]}`
          : `Time to take: ${medNames.join(", ")}`,
        tag: `med-${h}-${m}`,
        url: "/my-health",
        type: "medication",
        medication_id: meds[0].id,
        user_id: userId,
        scheduled_time: scheduleDate.toISOString(),
      };

      for (const sub of subs) {
        try {
          const res = await sendPushNotification(
            sub,
            payload,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY,
            VAPID_SUBJECT
          );

          if (res.status === 201 || res.status === 200) {
            sentCount++;
          } else if (res.status === 410 || res.status === 404) {
            // Subscription expired, remove it
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
