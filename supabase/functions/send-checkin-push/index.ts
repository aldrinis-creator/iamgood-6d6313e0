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

// Three reminder waves, anchored to scheduled_at.
// Cron runs every minute, so each wave uses a 1-minute window to fire once.
type Wave = { key: "due" | "t10" | "t30"; title: string; body: string; offsetMin: number };
const WAVES: Wave[] = [
  { key: "due", offsetMin: 0,  title: "✅ Check-iN Reminder",        body: "Time to check in! Let your guardians know you're okay." },
  { key: "t10", offsetMin: 10, title: "⏰ Check-iN still pending",   body: "You haven't checked in yet. Tap to let us know you're okay." },
  { key: "t30", offsetMin: 30, title: "⚠️ Final Check-iN reminder",  body: "Please check in now — your guardians will be alerted soon." },
];

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
      console.error("[send-checkin-push] AUTH REJECTED: caller is not the cron job");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    let totalSent = 0;
    const waveCounts: Record<string, number> = {};

    for (const wave of WAVES) {
      // Window: scheduled_at in [now - (offsetMin+1)min, now - offsetMin min)
      // For "due" (offset 0): scheduled_at in [now - 1min, now) — fires the minute it's due.
      const upper = new Date(now.getTime() - wave.offsetMin * 60 * 1000);
      const lower = new Date(upper.getTime() - 60 * 1000);

      const { data: checkIns, error: ciErr } = await supabase
        .from("check_ins")
        .select("id, user_id, scheduled_at")
        .eq("status", "pending")
        .gte("scheduled_at", lower.toISOString())
        .lt("scheduled_at", upper.toISOString());

      if (ciErr) {
        console.error(`[${wave.key}] fetch error:`, ciErr);
        continue;
      }
      if (!checkIns || checkIns.length === 0) {
        waveCounts[wave.key] = 0;
        continue;
      }

      const allUserIds = [...new Set(checkIns.map((ci: any) => ci.user_id))];

      // Guardian-role accounts must never receive ward (user) check-in pushes
      const { data: guardianRoleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", allUserIds)
        .eq("role", "guardian");
      const { data: guardianProfiles } = await supabase
        .from("profiles")
        .select("id")
        .in("id", allUserIds)
        .eq("role", "guardian");
      const guardianIds = new Set([
        ...(guardianRoleRows || []).map((r: any) => r.user_id),
        ...(guardianProfiles || []).map((p: any) => p.id),
      ]);
      const userIds = allUserIds.filter((id) => !guardianIds.has(id));
      if (userIds.length === 0) {
        waveCounts[wave.key] = 0;
        continue;
      }

      // Honor pause / checked-out state
      const { data: settingsData } = await supabase
        .from("user_settings")
        .select("user_id, settings")
        .in("user_id", userIds);

      const activeUserIds = new Set(userIds);

      const nowMs = now.getTime();
      if (settingsData) {
        for (const row of settingsData) {
          const settings = row.settings as any;
          if (settings?.pauseMode && settings.pauseMode !== "active") {
            let isPaused = true;
            if (settings.pauseMode === "checked-out" && settings.checkOutConfig) {
              const expiryStr = settings.checkOutConfig.endsAt || settings.checkOutConfig.endDate;
              if (expiryStr) {
                const expiryMs = new Date(expiryStr).getTime();
                if (expiryMs && expiryMs < nowMs) isPaused = false;
              }
            }
            if (isPaused) activeUserIds.delete(row.user_id);
          }
          // Respect per-user checkInPush opt-out
          if (settings?.checkInPush === false) activeUserIds.delete(row.user_id);
        }
      }

      let waveSent = 0;
      for (const userId of activeUserIds) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", userId);

        if (!subs || subs.length === 0) continue;

        const ci = checkIns.find((c: any) => c.user_id === userId);
        const tag = `checkin-${wave.key}-${ci?.id ?? userId}`;

        const payload = {
          title: wave.title,
          body: wave.body,
          tag,
          url: "/dashboard",
          type: "checkin",
          wave: wave.key,
          user_id: userId,
          requireInteraction: wave.key !== "due",
        };

        for (const sub of subs) {
          try {
            const res = await sendPushNotification(sub, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT);
            if (res.status === 201 || res.status === 200) {
              waveSent++;
            } else if (res.status === 410 || res.status === 404) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            } else {
              console.error(`[${wave.key}] push failed: ${res.status} ${await res.text()}`);
            }
          } catch (err) {
            console.error(`[${wave.key}] push error:`, err);
          }
        }
      }

      waveCounts[wave.key] = waveSent;
      totalSent += waveSent;
    }

    return new Response(
      JSON.stringify({ message: "Done", sent: totalSent, waves: waveCounts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
