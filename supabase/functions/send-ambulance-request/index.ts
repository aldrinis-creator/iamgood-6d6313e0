import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow";
const AMBULANCE_WHATSAPP_NUMBER = "918710810887";
const HELPLINE = "+917045868482";

interface Contact {
  name: string;
  phone: string;
  role: "patient" | "guardian";
}

interface RequestBody {
  source: "user" | "guardian";
  ward_user_id?: string | null;
  patient_name: string;
  pickup: { address: string; lat: number | null; lng: number | null };
  destination: { name: string; lat: number | null; lng: number | null };
  contacts: Contact[];
  force_channel?: "api" | "whatsapp";
}

function normalizePhone(p: string | null | undefined): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.startsWith("91") && digits.length === 12) return digits;
  return digits;
}

async function buildHealthSummary(supabase: any, userId: string): Promise<{ summary: string; profileLink: string }> {
  const [profileRes, healthRes, medsRes, tokenRes] = await Promise.all([
    supabase.from("profiles").select("full_name, date_of_birth, gender").eq("id", userId).maybeSingle(),
    supabase.from("health_profile").select("blood_group, allergies, chronic_conditions, family_doctor_name, family_doctor_phone").eq("user_id", userId).maybeSingle(),
    supabase.from("medications").select("name, dosage").eq("user_id", userId).limit(5),
    supabase.from("emergency_share_tokens").select("token").eq("user_id", userId).eq("is_active", true).maybeSingle(),
  ]);

  const parts: string[] = [];
  const h = healthRes.data;
  if (h?.blood_group) parts.push(`BG:${h.blood_group}`);
  if (h?.allergies?.length) parts.push(`Allergies:${h.allergies.slice(0, 3).join("/")}`);
  if (h?.chronic_conditions?.length) parts.push(`Cond:${h.chronic_conditions.slice(0, 3).join("/")}`);
  if (medsRes.data?.length) parts.push(`Meds:${medsRes.data.slice(0, 3).map((m: any) => m.name).join("/")}`);
  if (h?.family_doctor_phone) parts.push(`Dr:${h.family_doctor_name || ""} ${h.family_doctor_phone}`);

  const summary = parts.length ? parts.join(" | ") : "No health data";
  const profileLink = tokenRes.data?.token
    ? `https://iamgood.lovable.app/e/${tokenRes.data.token}`
    : "—";

  return { summary, profileLink };
}

async function tryAmbulanceApi(payload: any): Promise<{ ok: boolean; reason?: string; response?: any }> {
  const apiUrl = Deno.env.get("AMBULANCE_API_URL");
  const apiKey = Deno.env.get("AMBULANCE_API_KEY");

  if (!apiUrl || !apiKey) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, reason: res.ok ? undefined : `http_${res.status}`, response: json };
  } catch (e) {
    return { ok: false, reason: String((e as Error).message || e) };
  }
}

async function sendWhatsAppViaMsg91(body: RequestBody, healthSummary: string, profileLink: string): Promise<{ ok: boolean; response?: any }> {
  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  const templateId = Deno.env.get("MSG91_AMBULANCE_TEMPLATE_ID");
  if (!authKey || !templateId) {
    return { ok: false, response: { error: "MSG91 not configured" } };
  }

  const userPhone = body.contacts.find(c => c.role === "patient")?.phone || "";
  const guardianPhone = body.contacts.find(c => c.role === "guardian")?.phone || "—";

  const payload = {
    template_id: templateId,
    short_url: "0",
    recipients: [
      {
        mobiles: AMBULANCE_WHATSAPP_NUMBER,
        patient_name: body.patient_name,
        pickup_address: body.pickup.address || `${body.pickup.lat},${body.pickup.lng}`,
        destination: body.destination.name,
        user_phone: userPhone,
        guardian_phone: guardianPhone,
        health_summary: healthSummary.slice(0, 200),
        profile_link: profileLink,
      },
    ],
  };

  try {
    const res = await fetch(MSG91_FLOW_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    console.log("MSG91 ambulance response:", JSON.stringify(json));
    return { ok: res.ok, response: json };
  } catch (e) {
    return { ok: false, response: { error: String(e) } };
  }
}

async function notifyGuardians(supabase: any, body: RequestBody, ownerUserId: string, requestId: string) {
  // Find guardians of the OWNER (the patient). If guardian-initiated, also notify the user.
  const [guardiansRes, ownerProfileRes] = await Promise.all([
    supabase.from("guardians").select("guardian_user_id, guardian_phone, guardian_name, is_primary").eq("user_id", ownerUserId).eq("status", "accepted"),
    supabase.from("profiles").select("full_name").eq("id", ownerUserId).maybeSingle(),
  ]);

  const wardName = ownerProfileRes.data?.full_name || body.patient_name || "your ward";
  const notifications: any[] = [];

  // In-app: notify all accepted guardians
  for (const g of guardiansRes.data || []) {
    if (g.guardian_user_id) {
      notifications.push({
        user_id: g.guardian_user_id,
        title: `🚑 Ambulance dispatched for ${wardName}`,
        message: `Pickup: ${body.pickup.address || "current location"} → ${body.destination.name}`,
        type: "ambulance_dispatched",
      });
    }
  }

  // If guardian-initiated, notify the ward (patient) too
  if (body.source === "guardian") {
    notifications.push({
      user_id: ownerUserId,
      title: "🚑 Ambulance booked for you",
      message: `Your guardian booked an ambulance. Pickup: ${body.pickup.address || "your location"} → ${body.destination.name}`,
      type: "ambulance_dispatched",
    });
  }

  if (notifications.length > 0) {
    await supabase.rpc("insert_notifications_deduped", { p_notifications: notifications });
  }

  // MSG91 WhatsApp to primary guardian
  const primary = (guardiansRes.data || []).find((g: any) => g.is_primary) || (guardiansRes.data || [])[0];
  const guardianTemplateId = Deno.env.get("MSG91_AMBULANCE_GUARDIAN_NOTIFY_TEMPLATE_ID");
  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  if (primary?.guardian_phone && guardianTemplateId && authKey) {
    try {
      await fetch(MSG91_FLOW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", authkey: authKey },
        body: JSON.stringify({
          template_id: guardianTemplateId,
          short_url: "0",
          recipients: [{
            mobiles: normalizePhone(primary.guardian_phone),
            ward_name: wardName,
            pickup: body.pickup.address || "current location",
            destination: body.destination.name,
            request_id: requestId.slice(0, 8),
          }],
        }),
      });
    } catch (e) {
      console.warn("Guardian MSG91 notify failed:", e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body: RequestBody = await req.json();

    // The "owner" of the health record is the patient: ward in guardian mode, else self
    const ownerUserId = body.source === "guardian" && body.ward_user_id ? body.ward_user_id : user.id;
    const { summary: healthSummary, profileLink } = await buildHealthSummary(admin, ownerUserId);

    // Insert audit row
    const { data: inserted, error: insertErr } = await admin.from("ambulance_requests").insert({
      user_id: user.id,
      ward_user_id: body.source === "guardian" ? body.ward_user_id : null,
      source: body.source,
      channel: "pending",
      status: "pending",
      patient_name: body.patient_name,
      pickup_address: body.pickup.address,
      pickup_lat: body.pickup.lat,
      pickup_lng: body.pickup.lng,
      destination_name: body.destination.name,
      destination_lat: body.destination.lat,
      destination_lng: body.destination.lng,
      contacts: body.contacts,
      health_summary: healthSummary,
      payload: { ...body, profileLink },
    }).select("id").single();

    if (insertErr || !inserted) {
      console.error("Insert failed:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to record request" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const requestId = inserted.id;
    let channel: "api" | "whatsapp" | "failed" = "failed";
    let success = false;
    let message = "";
    let response: any = null;

    if (body.force_channel !== "whatsapp") {
      const apiResult = await tryAmbulanceApi({ ...body, healthSummary, profileLink, requestId });
      if (apiResult.ok) {
        channel = "api";
        success = true;
        response = apiResult.response;
        message = "Request sent via Ambulance Service. ETA confirmation will follow.";
      } else {
        console.log(`Ambulance API not used (${apiResult.reason}) — falling back to WhatsApp`);
      }
    }

    if (!success) {
      const waResult = await sendWhatsAppViaMsg91(body, healthSummary, profileLink);
      response = waResult.response;
      if (waResult.ok) {
        channel = "whatsapp";
        success = true;
        message = `Ambulance Service not reachable — sent via WhatsApp instead. Helpline: ${HELPLINE}`;
      } else {
        message = `Both channels failed — please call the helpline now: ${HELPLINE}`;
      }
    }

    await admin.from("ambulance_requests")
      .update({ channel, status: success ? "sent" : "failed", response, error_message: success ? null : message })
      .eq("id", requestId);

    // Fire-and-forget guardian notifications when successfully dispatched
    if (success) {
      notifyGuardians(admin, body, ownerUserId, requestId).catch(e => console.warn("notifyGuardians error:", e));
    }

    return new Response(JSON.stringify({ success, channel, message, requestId, helpline: HELPLINE }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-ambulance-request error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
