import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC_KEY = "BJq2e6gs1zTIdmNLo6v4DWL4trzwEedK_ghxuB9wb63nlh_y1ShYf2RS_IKdDdPu59tQJ3pLk5XHed6pGZ141lw";
const VAPID_SUBJECT = "mailto:checkin_support@futurewave.in";

function b64urlToBytes(s: string): Uint8Array {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob(base64 + padding);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapid(pub: string, priv: string) {
  const privBytes = b64urlToBytes(priv);
  const pubBytes = b64urlToBytes(pub);
  return await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToB64url(pubBytes.slice(1, 33)),
      y: bytesToB64url(pubBytes.slice(33, 65)),
      d: bytesToB64url(privBytes),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function createJWT(key: CryptoKey, aud: string, sub: string) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud, exp: now + 12 * 3600, sub };
  const h = bytesToB64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${h}.${p}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  let bytes = new Uint8Array(sig);
  if (bytes[0] === 0x30) {
    const rLen = bytes[3];
    const rStart = 4;
    let r = bytes.slice(rStart, rStart + rLen);
    const sLen = bytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    let s = bytes.slice(sStart, sStart + sLen);
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const pad = new Uint8Array(32); pad.set(r, 32 - r.length); r = pad; }
    if (s.length < 32) { const pad = new Uint8Array(32); pad.set(s, 32 - s.length); s = pad; }
    bytes = new Uint8Array(64);
    bytes.set(r, 0);
    bytes.set(s, 32);
  }
  return `${unsigned}.${bytesToB64url(bytes)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const wardId = userData.user.id;

    const { guardian_id } = await req.json().catch(() => ({}));
    if (!guardian_id) {
      return new Response(JSON.stringify({ error: "guardian_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, serviceKey);

    const { data: guardian } = await admin
      .from("guardians")
      .select("id, guardian_name, guardian_phone, guardian_user_id, user_id")
      .eq("id", guardian_id)
      .maybeSingle();

    if (!guardian || guardian.user_id !== wardId) {
      return new Response(JSON.stringify({ error: "Not your guardian" }), { status: 403, headers: corsHeaders });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", wardId)
      .maybeSingle();
    const wardName = profile?.full_name || "Your ward";

    let guardianUserId = guardian.guardian_user_id as string | null;
    if (!guardianUserId && guardian.guardian_phone) {
      const { data: gp } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", guardian.guardian_phone)
        .maybeSingle();
      guardianUserId = gp?.id || null;
    }

    const title = "📞 Incoming call from your ward";
    const body = `${wardName} is calling you now.`;

    let sent = 0;
    if (guardianUserId) {
      await admin.rpc("insert_notification_deduped", {
        p_user_id: guardianUserId,
        p_title: title,
        p_message: body,
        p_type: "guardian_call",
        p_guardian_id: guardian.id,
      });

      const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
      if (vapidPriv) {
        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", guardianUserId);
        if (subs && subs.length) {
          const key = await importVapid(VAPID_PUBLIC_KEY, vapidPriv);
          for (const s of subs) {
            try {
              const url = new URL(s.endpoint);
              const jwt = await createJWT(key, `${url.protocol}//${url.host}`, VAPID_SUBJECT);
              const payload = JSON.stringify({
                title,
                body,
                tag: `guardian-call-${guardian.id}`,
                url: "/guardian",
                type: "guardian_call",
                requireInteraction: true,
              });
              const res = await fetch(s.endpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  TTL: "600",
                  Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
                },
                body: payload,
              });
              if (res.status === 201 || res.status === 200) sent++;
              else if (res.status === 410 || res.status === 404) {
                await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
              }
            } catch (e) {
              console.error("push fail", e);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
