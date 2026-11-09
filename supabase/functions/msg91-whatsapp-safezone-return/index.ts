import { requireUser, acceptedGuardianPhones, serviceClient } from "../_shared/guard.ts";
import { insideZone, RETURN_COOLDOWN_MS } from "../_shared/securityRules.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_WA_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";
const INTEGRATED_NUMBER = "917045868482";
const TEMPLATE_NAME = "safe_zone_return";
const NAMESPACE = "e67e5302_b6d0_403e_b3cc_8fa6e8accb01";

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) digits = "91" + digits;
  if (digits.startsWith("0") && digits.length === 11) digits = "91" + digits.slice(1);
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    if (!authKey) {
      console.error("MSG91_AUTH_KEY not configured");
      return new Response(JSON.stringify({ error: "MSG91 not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const __u = await requireUser(req, corsHeaders);
    if (__u.error) return __u.error;
    if (!__u.caller) {
      return new Response(JSON.stringify({ error: "Ward sign-in required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const wardId = __u.caller.id;
    const zoneId = String(body?.zoneId ?? "");
    const lat = Number(body?.lat), lng = Number(body?.lng);
    if (!zoneId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(JSON.stringify({ error: "zoneId, lat, lng required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const svc = serviceClient();
    const { data: zone } = await svc.from("safe_zones").select("id,name,lat,lng,radius_m,enabled,user_id")
      .eq("id", zoneId).eq("user_id", wardId).maybeSingle();
    if (!zone || !zone.enabled || !insideZone(lat, lng, zone)) {
      return new Response(JSON.stringify({ error: "Not inside this safe zone" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: settingsRow } = await svc.from("user_settings").select("settings").eq("user_id", wardId).maybeSingle();
    const settings = (settingsRow?.settings as Record<string, unknown>) || {};
    const lastSent = Date.parse(String((settings as any).lastZoneReturnAlertAt ?? ""));
    if (Number.isFinite(lastSent) && Date.now() - lastSent < RETURN_COOLDOWN_MS) {
      return new Response(JSON.stringify({ success: true, skipped: "cooldown" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: prof } = await svc.from("profiles").select("full_name").eq("user_id", wardId).maybeSingle();
    const wardName = String(prof?.full_name || "Your ward").trim();
    const zoneName = String(zone.name).trim();
    const phonesIn = Array.from(await acceptedGuardianPhones(wardId));
    if (phonesIn.length === 0) {
      return new Response(JSON.stringify({ error: "No accepted guardians" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await svc.from("user_settings").update({ settings: { ...settings, lastZoneReturnAlertAt: new Date().toISOString() } }).eq("user_id", wardId);

    const phones = Array.from(
      new Set(
        (phonesIn as unknown[])
          .map((p) => normalizePhone(String(p ?? "")))
          .filter((p): p is string => !!p)
      )
    );

    if (phones.length === 0) {
      return new Response(JSON.stringify({ error: "No valid phones" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      integrated_number: INTEGRATED_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: TEMPLATE_NAME,
          language: { code: "en", policy: "deterministic" },
          namespace: NAMESPACE,
          to_and_components: [
            {
              to: phones,
              components: {
                body_1: { type: "text", value: wardName },
                body_2: { type: "text", value: zoneName },
              },
            },
          ],
        },
      },
    };

    const res = await fetch(MSG91_WA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }

    if (!res.ok) {
      console.error("MSG91 WhatsApp safe_zone_return failed", res.status);
    } else {
      console.log("MSG91 WhatsApp safe_zone_return sent to", phones.length, "recipients");
    }

    return new Response(
      JSON.stringify({ success: res.ok, status: res.status }),
      {
        status: res.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("msg91-whatsapp-safezone-return error:", err);
    return new Response(JSON.stringify({ error: "Could not send alert" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
