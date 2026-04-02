import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Web Push utilities (same as send-medication-push) ──

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

// ── Email helper ──

async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.log("No RESEND_API_KEY configured, skipping email");
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "Check-iN Alerts <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to send email to ${to}:`, err);
    return false;
  }
  return true;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const vapidPublicKey = "BJq2e6gs1zTIdmNLo6v4DWL4trzwEedK_ghxuB9wb63nlh_y1ShYf2RS_IKdDdPu59tQJ3pLk5XHed6pGZ141lw";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const vapidSubject = "mailto:alerts@check-in.app";

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const { data: pendingCheckIns, error: fetchError } = await supabase
      .from("check_ins")
      .select("id, user_id, scheduled_at")
      .eq("status", "pending")
      .lt("scheduled_at", tenMinutesAgo.toISOString());

    if (fetchError) {
      console.error("Error fetching pending check-ins:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingCheckIns || pendingCheckIns.length === 0) {
      return new Response(
        JSON.stringify({ message: "No missed check-ins found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingCheckIns.length} missed check-ins`);

    let notificationsCreated = 0;
    let emailsSent = 0;
    let pushesSent = 0;

    for (const checkIn of pendingCheckIns) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", checkIn.user_id)
        .single();

      const userName = profile?.full_name || "Your ward";

      const { data: guardians } = await supabase
        .from("guardians")
        .select("id, guardian_name, guardian_email, guardian_phone")
        .eq("user_id", checkIn.user_id);

      if (guardians && guardians.length > 0) {
        const scheduledTime = new Date(checkIn.scheduled_at);
        // Convert to IST manually (UTC+5:30) for reliable formatting
        const istMs = scheduledTime.getTime() + (5.5 * 60 * 60 * 1000);
        const istDate = new Date(istMs);
        const istHours = istDate.getUTCHours();
        const istMinutes = istDate.getUTCMinutes();
        const period = istHours >= 12 ? "PM" : "AM";
        const displayHour = istHours % 12 || 12;
        const timeStr = `${displayHour}:${String(istMinutes).padStart(2, "0")} ${period}`;

        const message = `${userName} missed their ${timeStr} check-in. Please reach out to make sure they're okay.`;

        for (const guardian of guardians) {
          // Create in-app notification
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: checkIn.user_id,
              guardian_id: guardian.id,
              type: "missed_checkin",
              title: "Missed Check-In Alert",
              message,
            });

          if (notifError) {
            console.error("Error creating notification:", notifError);
          } else {
            notificationsCreated++;
          }

          // Send email if guardian has an email
          if (guardian.guardian_email) {
            const html = `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #dc2626; margin-bottom: 8px;">⚠️ Missed Check-In Alert</h2>
                <p style="font-size: 16px; color: #333;">${message}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
                <p style="font-size: 13px; color: #888;">
                  This alert was sent by <strong>Check-iN</strong> — Personal Emergency Response System.
                </p>
              </div>
            `;
            const sent = await sendEmail(
              guardian.guardian_email,
              `⚠️ ${userName} missed their check-in`,
              html
            );
            if (sent) emailsSent++;
          }

          // Send push notification to guardian's registered devices
          if (vapidPrivateKey) {
            // Find the guardian's user account via their phone number
            const { data: guardianProfile } = await supabase
              .from("profiles")
              .select("id")
              .eq("phone", guardian.guardian_phone)
              .maybeSingle();

            if (guardianProfile?.id) {
              const { data: subs } = await supabase
                .from("push_subscriptions")
                .select("endpoint, p256dh, auth")
                .eq("user_id", guardianProfile.id);

              if (subs && subs.length > 0) {
                for (const sub of subs) {
                  try {
                    const res = await sendPushNotification(
                      sub,
                      {
                        title: "⚠️ Missed Check-In Alert",
                        body: message,
                        tag: "missed-checkin",
                        url: "/guardian",
                      },
                      vapidPublicKey,
                      vapidPrivateKey,
                      vapidSubject
                    );

                    if (res.status === 201 || res.status === 200) {
                      pushesSent++;
                    } else if (res.status === 410 || res.status === 404) {
                      // Subscription expired, clean up
                      await supabase
                        .from("push_subscriptions")
                        .delete()
                        .eq("endpoint", sub.endpoint);
                    }
                    // Consume response body
                    await res.text();
                  } catch (pushErr) {
                    console.error("Push send error:", pushErr);
                  }
                }
              }
            }
          }
        }
      }

      // MSG91 WhatsApp notification
      const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
      const msg91CheckinTemplate = Deno.env.get("MSG91_CHECKIN_TEMPLATE_ID");
      if (msg91AuthKey && msg91CheckinTemplate) {
        const recipients = guardians
          .filter((g: any) => g.guardian_phone)
          .map((g: any) => {
            const clean = g.guardian_phone.replace(/[^0-9]/g, "");
            const mobile = clean.startsWith("91") ? clean : `91${clean}`;
            return { mobiles: mobile, user_name: userName, message };
          });

        if (recipients.length > 0) {
          try {
            await fetch("https://control.msg91.com/api/v5/flow", {
              method: "POST",
              headers: { "Content-Type": "application/json", authkey: msg91AuthKey },
              body: JSON.stringify({ template_id: msg91CheckinTemplate, short_url: "0", recipients }),
            });
          } catch (e) {
            console.error("MSG91 checkin alert error:", e);
          }
        }
      }

      // Mark check-in as missed
      await supabase
        .from("check_ins")
        .update({ status: "missed" })
        .eq("id", checkIn.id);
    }

    console.log(`Created ${notificationsCreated} notifications, sent ${emailsSent} emails, ${pushesSent} pushes`);

    return new Response(
      JSON.stringify({
        message: "Processed missed check-ins",
        missed: pendingCheckIns.length,
        notifications: notificationsCreated,
        emails: emailsSent,
        pushes: pushesSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
