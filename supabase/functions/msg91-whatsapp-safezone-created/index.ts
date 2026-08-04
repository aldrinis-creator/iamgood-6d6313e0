import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MSG91_WA_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";
const INTEGRATED_NUMBER = "917045868482";
const TEMPLATE_NAME = "safe_zone_creation_user";
const NAMESPACE = "e67e5302_b6d0_403e_b3cc_8fa6e8accb01";

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
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

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    const userId = userData?.user?.id;
    if (userErr || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();

    const { data: guardians } = await admin
      .from("guardians")
      .select("guardian_phone")
      .eq("user_id", userId)
      .eq("status", "accepted");

    const phones = Array.from(
      new Set(
        [
          profile?.phone ?? "",
          ...(guardians ?? []).map((g: any) => g.guardian_phone ?? ""),
        ]
          .map((p) => normalizePhone(String(p)))
          .filter((p): p is string => !!p),
      ),
    );

    if (phones.length === 0) {
      console.log("safe_zone_creation_user: no valid phone on file");
      return new Response(JSON.stringify({ success: true, skipped: "no phone" }), {
        status: 200,
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
          language: { code: "en_US", policy: "deterministic" },
          namespace: NAMESPACE,
          to_and_components: [{ to: phones, components: {} }],
        },
      },
    };

    const res = await fetch(MSG91_WA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
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
      console.error("MSG91 WA safe_zone_creation_user failed", res.status, text);
    } else {
      console.log("MSG91 WA safe_zone_creation_user sent to", phones.length, "recipient(s)");
    }

    return new Response(JSON.stringify({ success: res.ok, status: res.status, result }), {
      status: res.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("msg91-whatsapp-safezone-created error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
