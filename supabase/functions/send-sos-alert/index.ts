import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, message, guardian_emails, doctor_email, doctor_name, user_name } = await req.json();

    if (!user_id || !message) {
      return new Response(JSON.stringify({ error: "user_id and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Build HTML email
    const htmlMessage = message
      .replace(/\n/g, "<br>")
      .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb">$1</a>');

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:2px solid #dc2626">
        <div style="text-align:center;padding:16px;background:#dc2626;border-radius:8px;margin-bottom:16px">
          <h1 style="color:#fff;margin:0;font-size:24px">🚨 EMERGENCY SOS ALERT</h1>
        </div>
        <div style="padding:16px;font-size:15px;line-height:1.6;color:#1a1a1a">
          ${htmlMessage}
        </div>
        <div style="margin-top:16px;padding:12px;background:#fef2f2;border-radius:8px;text-align:center">
          <p style="margin:0;color:#dc2626;font-weight:bold">⚠️ This is an emergency alert. Please respond immediately.</p>
        </div>
      </div>
    `;

    const emailResults = [];

    // Send to guardians
    const allEmails = [...(guardian_emails || [])];
    if (doctor_email) allEmails.push(doctor_email);

    for (const email of allEmails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Check-iN SOS <onboarding@resend.dev>",
            to: [email],
            subject: `🚨 EMERGENCY SOS from ${user_name || "Check-iN User"}`,
            html: emailHtml,
          }),
        });
        const result = await res.json();
        emailResults.push({ email, success: res.ok, result });
      } catch (e) {
        emailResults.push({ email, success: false, error: String(e) });
      }
    }

    // Create notifications for guardians in DB
    const { data: guardianRows } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", user_id);

    if (guardianRows?.length) {
      const notifRows = guardianRows.map((g: any) => ({
        user_id,
        guardian_id: g.id,
        title: "🚨 SOS Alert Triggered",
        message: `Emergency SOS alert from ${user_name || "User"}. Check email and WhatsApp for details.`,
        type: "sos_alert",
      }));
      await supabase.from("notifications").insert(notifRows);
    }

    return new Response(JSON.stringify({ sent: emailResults.length, results: emailResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
