import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Thresholds for anomaly detection
const THRESHOLDS = {
  heart_rate_high: 120,
  heart_rate_low: 45,
  spo2_low: 92,
  stress_score_high: 80,
};

function base64urlToBytes(b: string): Uint8Array {
  const bin = atob(b.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (b.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidKeys(pub: string, priv: string) {
  const privKey = await crypto.subtle.importKey("raw", base64urlToBytes(priv), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { publicKey: pub, privateKey: privKey };
}

async function createJWT(privKey: CryptoKey, aud: string, sub: string) {
  const header = bytesToBase64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = bytesToBase64url(new TextEncoder().encode(JSON.stringify({ aud, exp: now + 86400, sub, iat: now })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${bytesToBase64url(new Uint8Array(sig))}`;
}

async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: object, vapidPub: string, vapidPriv: string, vapidSub: string) {
  try {
    const keys = await importVapidKeys(vapidPub, vapidPriv);
    const url = new URL(sub.endpoint);
    const jwt = await createJWT(keys.privateKey, `${url.protocol}//${url.host}`, vapidSub);
    const body = JSON.stringify(payload);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `vapid t=${jwt}, k=${vapidPub}`,
        TTL: "3600",
      },
      body,
    });
    return res.status;
  } catch {
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const _anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const _userClient = createClient(_supabaseUrl, _anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: _userData, error: _userErr } = await _userClient.auth.getUser();
    if (_userErr || !_userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_id, heart_rate, spo2, stress_score, source } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (user_id !== _userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check for anomalies
    const anomalies: string[] = [];
    if (heart_rate && heart_rate > THRESHOLDS.heart_rate_high)
      anomalies.push(`High heart rate: ${heart_rate} bpm`);
    if (heart_rate && heart_rate < THRESHOLDS.heart_rate_low)
      anomalies.push(`Low heart rate: ${heart_rate} bpm`);
    if (spo2 && spo2 > 0 && spo2 < THRESHOLDS.spo2_low)
      anomalies.push(`Low SpO2: ${spo2}%`);
    if (stress_score && stress_score > THRESHOLDS.stress_score_high)
      anomalies.push(`High stress score: ${stress_score}`);

    if (anomalies.length === 0) {
      return new Response(JSON.stringify({ anomalies: 0, message: "All vitals normal" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user_id)
      .single();
    const userName = profile?.full_name || "Your ward";

    // Get guardians
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id, guardian_name, guardian_phone, guardian_email")
      .eq("user_id", user_id);

    if (!guardians || guardians.length === 0) {
      return new Response(JSON.stringify({ anomalies: anomalies.length, notified: 0, message: "No guardians configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anomalyText = anomalies.join(", ");
    const title = `⚠️ Vital Anomaly — ${userName}`;
    const message = `${userName}'s vitals show: ${anomalyText}. Source: ${source || "vitals check"}. Please check on them.`;

    // Create notifications for each guardian
    const notifRows = guardians.map((g) => ({
      user_id,
      guardian_id: g.id,
      title,
      message,
      type: "vital_anomaly",
    }));
    await supabase.rpc("insert_notifications_deduped", { p_notifications: notifRows });

    // Send email via transactional email queue
    let emailsQueued = 0;
    for (const g of guardians) {
      const email = g.guardian_email;
      if (!email) continue;
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "vital-anomaly-alert",
            recipientEmail: email,
            idempotencyKey: `vital-anomaly-${user_id}-${g.id}-${Date.now()}`,
            templateData: {
              userName,
              guardianName: g.guardian_name,
              anomalies,
              source: source || "vitals check",
            },
          },
        });
        emailsQueued++;
      } catch (emailErr) {
        console.error("Email queue error:", emailErr);
      }
    }

    // Send push notifications
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || Deno.env.get("VAPID_Public_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    let pushSent = 0;

    if (vapidPublicKey && vapidPrivateKey) {
      for (const g of guardians) {
        const { data: gProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", g.guardian_phone)
          .maybeSingle();
        if (!gProfile) continue;

        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", gProfile.id);
        if (!subs) continue;

        for (const sub of subs) {
          const status = await sendPush(
            sub,
            { title, body: message, icon: "/favicon.ico", tag: `vital-anomaly-${user_id}` },
            vapidPublicKey,
            vapidPrivateKey,
            "mailto:alerts@checkin.lovable.app"
          );
          if (status === 201 || status === 200) pushSent++;
          if (status === 410 || status === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ anomalies: anomalies.length, notified: guardians.length, emailsQueued, pushSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
