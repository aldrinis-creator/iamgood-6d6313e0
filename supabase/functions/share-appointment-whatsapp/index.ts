import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_WA_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

const DEFAULT_INTEGRATED_NUMBER = "917045868482";
const DEFAULT_TEMPLATE_NAME = "appointment_share_notification";
const DEFAULT_LANG = "en";

interface Recipient {
  phone: string;
  name: string;
}

interface Appointment {
  id: string;
  title?: string;
  start_date?: string;
  start_time?: string;
  location?: string | null;
  doctor_name?: string | null;
}

function normalizePhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

function formatDate(d?: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

Deno.serve(async (req) => {
  console.log("[share-appointment-whatsapp] request received", { method: req.method });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: _u, error: _e } = await _uc.auth.getUser();
    if (_e || !_u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = _u.user.id;

    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const integratedNumber =
      Deno.env.get("MSG91_INTEGRATED_NUMBER") || DEFAULT_INTEGRATED_NUMBER;
    const templateName =
      Deno.env.get("MSG91_APPT_SHARE_TEMPLATE_NAME") || DEFAULT_TEMPLATE_NAME;
    const namespaceRaw = Deno.env.get("MSG91_APPT_SHARE_TEMPLATE_ID") || "";
    const namespace =
      !namespaceRaw || namespaceRaw.toLowerCase() === "null" ? null : namespaceRaw;
    const langCode = Deno.env.get("MSG91_APPT_SHARE_LANG") || DEFAULT_LANG;

    console.log("[share-appointment-whatsapp] config", {
      hasAuth: !!authKey,
      integratedNumber,
      templateName,
      namespace,
      langCode,
    });

    if (!authKey) {
      console.error("[share-appointment-whatsapp] MSG91_AUTH_KEY missing");
      return new Response(
        JSON.stringify({ success: false, error: "MSG91 not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { appointment, recipients } = (await req.json()) as {
      appointment: Appointment;
      recipients: Recipient[];
    };

    if (!appointment?.id || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "appointment and recipients[] are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify appointment ownership and restrict recipients to caller's accepted guardians
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: apptRow } = await admin
      .from("appointments")
      .select("user_id")
      .eq("id", appointment.id)
      .maybeSingle();
    if (!apptRow || apptRow.user_id !== callerId) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: guardianRows } = await admin
      .from("guardians")
      .select("guardian_phone, guardian_name")
      .eq("user_id", callerId)
      .eq("status", "accepted");
    const allowedPhones = new Set(
      (guardianRows || [])
        .map((g: any) => normalizePhone(g.guardian_phone || ""))
        .filter((p: string) => p.length >= 11)
    );

    const MAX_RECIPIENTS = 5;
    const filteredRecipients = recipients
      .filter((r) => allowedPhones.has(normalizePhone(r.phone || "")))
      .slice(0, MAX_RECIPIENTS);

    if (filteredRecipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipients must be your accepted guardians" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = appointment.title || "Appointment";
    const dateStr = formatDate(appointment.start_date);
    const timeStr = (appointment.start_time || "").slice(0, 5);
    const doctor = appointment.doctor_name || "Not specified";
    const location = appointment.location ? `, ${appointment.location}` : "";
    const body5 = `${doctor}${location}`.slice(0, 200);

    const to_and_components = recipients
      .map((r) => {
        const mobile = normalizePhone(r.phone);
        if (mobile.length < 11) return null;
        return {
          to: [mobile],
          components: {
            body_1: { type: "text", value: (r.name || "there").slice(0, 60) },
            body_2: { type: "text", value: title.slice(0, 100) },
            body_3: { type: "text", value: dateStr },
            body_4: { type: "text", value: timeStr },
            body_5: { type: "text", value: body5 },
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (to_and_components.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid recipient phone numbers" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log("[share-appointment-whatsapp] calling MSG91 WA", {
      templateName,
      namespace,
      recipientCount: to_and_components.length,
    });

    const res = await fetch(MSG91_WA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    let result: unknown = rawText;
    try { result = JSON.parse(rawText); } catch { /* not JSON */ }

    console.log("[share-appointment-whatsapp] MSG91 WA response", {
      status: res.status,
      body: rawText.slice(0, 600),
    });

    const obj = (typeof result === "object" && result !== null) ? (result as Record<string, unknown>) : null;
    const msgType = obj?.type as string | undefined;
    const requestId = obj?.request_id ?? obj?.message ?? null;
    const errorMsg = (obj?.message && msgType === "error")
      ? String(obj.message)
      : (obj?.error ? String(obj.error) : null);

    const isSuccess = res.ok && (msgType === "success" || (!!requestId && msgType !== "error"));

    if (!isSuccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg || `HTTP ${res.status}`,
          http_status: res.status,
          result,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark appointment as shared
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase
        .from("appointments")
        .update({ share_status: "shared" })
        .eq("id", appointment.id);
    } catch (e) {
      console.error("[share-appointment-whatsapp] failed to update share_status", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        result,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[share-appointment-whatsapp] uncaught error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
