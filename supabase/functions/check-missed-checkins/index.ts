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

    // Deduplicate: keep only ONE pending check-in per user+scheduled_hour
    const seen = new Set<string>();
    const uniqueCheckIns: typeof pendingCheckIns = [];
    const duplicateIds: string[] = [];
    for (const ci of pendingCheckIns) {
      const scheduledDate = new Date(ci.scheduled_at);
      const key = `${ci.user_id}-${scheduledDate.getUTCFullYear()}-${scheduledDate.getUTCMonth()}-${scheduledDate.getUTCDate()}-${scheduledDate.getUTCHours()}`;
      if (seen.has(key)) {
        duplicateIds.push(ci.id);
      } else {
        seen.add(key);
        uniqueCheckIns.push(ci);
      }
    }

    // Mark duplicates as missed immediately without sending alerts
    if (duplicateIds.length > 0) {
      await supabase.from("check_ins").update({ status: "missed" }).in("id", duplicateIds);
      console.log(`Silently marked ${duplicateIds.length} duplicate check-ins as missed`);
    }

    console.log(`Found ${pendingCheckIns.length} missed check-ins`);

    let notificationsCreated = 0;
    let emailsSent = 0;
    let pushesSent = 0;

    for (const checkIn of uniqueCheckIns) {
      // ── Safety check: verify no "responded" record exists for this user+slot ──
      const scheduledDate = new Date(checkIn.scheduled_at);
      const slotStart = new Date(scheduledDate);
      slotStart.setMinutes(0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // +1 hour

      const { data: respondedRecords } = await supabase
        .from("check_ins")
        .select("id")
        .eq("user_id", checkIn.user_id)
        .eq("status", "responded")
        .gte("scheduled_at", slotStart.toISOString())
        .lt("scheduled_at", slotEnd.toISOString())
        .limit(1);

      if (respondedRecords && respondedRecords.length > 0) {
        // User already responded — mark this orphan as responded, skip alerts
        await supabase
          .from("check_ins")
          .update({ status: "responded", response: "ok", responded_at: new Date().toISOString() })
          .eq("id", checkIn.id)
          .eq("status", "pending");
        console.log(`Orphan check-in ${checkIn.id} resolved — user already responded`);
        continue;
      }

      // ── Mark as missed FIRST to prevent duplicate processing by next cron run ──
      const { error: updateError } = await supabase
        .from("check_ins")
        .update({ status: "missed" })
        .eq("id", checkIn.id)
        .eq("status", "pending"); // optimistic lock: only if still pending

      if (updateError) {
        console.error("Error marking check-in as missed:", updateError);
        continue; // skip — another run likely already processed it
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", checkIn.user_id)
        .single();

      const userName = profile?.full_name || "Your ward";

      const { data: guardians } = await supabase
        .from("guardians")
        .select("id, guardian_name, guardian_email, guardian_phone")
        .eq("user_id", checkIn.user_id)
        .eq("status", "accepted");

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

        // ── Use deduped RPC for in-app notifications ──
        const notifications = guardians.map((g) => ({
          user_id: checkIn.user_id,
          guardian_id: g.id,
          title: "Missed Check-In Alert",
          message,
          type: "missed_checkin",
        }));

        const { error: dedupError } = await supabase.rpc("insert_notifications_deduped", {
          p_notifications: notifications,
        });
        if (dedupError) {
          console.error("Deduped notification error:", dedupError);
        } else {
          notificationsCreated += guardians.length;
        }

        for (const guardian of guardians) {
          // Send email via transactional email queue (idempotency key prevents duplicates)
          if (guardian.guardian_email) {
            try {
              await supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "missed-checkin-alert",
                  recipientEmail: guardian.guardian_email,
                  idempotencyKey: `missed-checkin-${checkIn.id}-${guardian.id}`,
                  templateData: {
                    userName,
                    guardianName: guardian.guardian_name,
                    timeStr,
                    message,
                  },
                },
              });
              emailsSent++;
            } catch (emailErr) {
              console.error("Email queue error:", emailErr);
            }
          }

          // Send push notification to guardian's registered devices
          if (vapidPrivateKey) {
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
                        tag: `missed-checkin-${checkIn.id}`,
                        url: "/guardian",
                      },
                      vapidPublicKey,
                      vapidPrivateKey,
                      vapidSubject
                    );

                    if (res.status === 201 || res.status === 200) {
                      pushesSent++;
                    } else if (res.status === 410 || res.status === 404) {
                      await supabase
                        .from("push_subscriptions")
                        .delete()
                        .eq("endpoint", sub.endpoint);
                    }
                    await res.text();
                  } catch (pushErr) {
                    console.error("Push send error:", pushErr);
                  }
                }
              }
            }
          }
        }

        // MSG91 WhatsApp notification — dedup: only send if this is the first notification batch
        const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
        const msg91CheckinTemplate = Deno.env.get("MSG91_CHECKIN_TEMPLATE_ID");
        if (msg91AuthKey && msg91CheckinTemplate && !dedupError) {
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
      }
    }

    console.log(`Created ${notificationsCreated} notifications, sent ${emailsSent} emails, ${pushesSent} pushes`);

    return new Response(
      JSON.stringify({
        message: "Processed missed check-ins",
        missed: uniqueCheckIns.length,
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
