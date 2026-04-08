const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guardian_email, guardian_name, guardian_phone, user_name, relation, nomination_token } = await req.json();

    if (!guardian_name || !user_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate-limit: check if invite was sent < 1 hour ago
    if (guardian_email || guardian_phone) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      let query = supabase.from("guardians").select("nominated_at").gte("nominated_at", oneHourAgo);
      if (guardian_email) query = query.eq("guardian_email", guardian_email);
      else query = query.eq("guardian_phone", guardian_phone);

      const { data: recentInvites } = await query;
      if (recentInvites && recentInvites.length > 0) {
        return new Response(
          JSON.stringify({ message: "Invite already sent recently. Please wait before re-sending.", rate_limited: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const relationText = relation ? ` (${relation})` : "";
    const subject = `${user_name} has nominated you as their Guardian on Check-iN`;

    // Build accept/reject links if token provided
    const baseUrl = "https://iamgood.lovable.app";
    const acceptLink = nomination_token ? `${baseUrl}/register?nomination=accept&token=${nomination_token}` : `${baseUrl}/register`;
    const rejectLink = nomination_token ? `${baseUrl}/register?nomination=reject&token=${nomination_token}` : "";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: #2d5f3f; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">C-iN</div>
          <h1 style="color: #1a365d; margin-top: 15px;">You've Been Nominated as a Guardian</h1>
        </div>
        
        <p style="font-size: 16px; color: #333;">Hi ${guardian_name},</p>
        
        <p style="font-size: 16px; color: #333;">
          <strong>${user_name}</strong>${relationText} has nominated you as their <strong>Guardian</strong> on <strong>Check-iN</strong> — a personal emergency response app.
        </p>
        
        <div style="background: #f0f9ff; border-left: 4px solid #1a365d; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #1a365d;"><strong>What does this mean?</strong></p>
          <p style="margin: 8px 0 0; font-size: 14px; color: #555;">
            As a Guardian, you'll receive real-time alerts about ${user_name}'s safety including:
          </p>
          <ul style="font-size: 14px; color: #555;">
            <li>🆘 SOS emergency alerts with location</li>
            <li>✅ Daily check-in status updates</li>
            <li>💊 Medication adherence notifications</li>
            <li>📋 Health passport and vitals reports</li>
            <li>🚨 Fall detection alerts</li>
          </ul>
        </div>

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #856404;"><strong>⏰ 24-Hour Window</strong></p>
          <p style="margin: 8px 0 0; font-size: 14px; color: #856404;">
            You have <strong>24 hours</strong> to reject this nomination. If you do not reject within 24 hours, the nomination is <strong>automatically accepted</strong>.
          </p>
        </div>
        
        ${rejectLink ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptLink}" 
             style="background: #1a365d; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; margin-right: 10px;">
            ✅ Accept & Create Account
          </a>
          <br/><br/>
          <a href="${rejectLink}" 
             style="background: #dc3545; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px;">
            ❌ Reject Nomination
          </a>
        </div>
        ` : `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptLink}" 
             style="background: #1a365d; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Create Your Guardian Account
          </a>
        </div>
        `}
        
        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px;">
          Check-iN — Personal Emergency Response System<br/>
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

    // Send email if email provided
    if (guardian_email) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Check-iN <onboarding@resend.dev>",
            to: [guardian_email],
            subject,
            html,
          }),
        });
        const emailResult = await emailRes.json();
        console.log("Email sent:", emailResult);
      }
    }

    // Send WhatsApp/SMS via MSG91 if phone provided
    if (guardian_phone) {
      const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
      const msg91InviteTemplate = Deno.env.get("MSG91_INVITE_TEMPLATE_ID");
      if (msg91AuthKey && msg91InviteTemplate) {
        const clean = guardian_phone.replace(/[^0-9]/g, "");
        const mobile = clean.startsWith("91") ? clean : `91${clean}`;
        try {
          await fetch("https://control.msg91.com/api/v5/flow", {
            method: "POST",
            headers: { "Content-Type": "application/json", authkey: msg91AuthKey },
            body: JSON.stringify({
              template_id: msg91InviteTemplate,
              short_url: "1",
              recipients: [{
                mobiles: mobile,
                guardian_name,
                user_name,
                relation: relationText,
                accept_link: acceptLink,
                reject_link: rejectLink || "",
              }],
            }),
          });
          console.log("MSG91 invite sent to:", mobile);
        } catch (e) {
          console.error("MSG91 invite error:", e);
        }
      } else {
        // Fallback: log WhatsApp link
        const whatsappMsg = encodeURIComponent(
          `🛡️ *Guardian Nomination — Check-iN*\n\nHi ${guardian_name},\n\n*${user_name}*${relationText} has nominated you as their Guardian on Check-iN.\n\n✅ Accept: ${acceptLink}\n${rejectLink ? `❌ Reject: ${rejectLink}\n` : ""}\nCheck-iN — Personal Emergency Response System`
        );
        console.log(`WhatsApp link: https://wa.me/${guardian_phone.replace(/[^0-9]/g, "")}?text=${whatsappMsg}`);
      }
    }

    return new Response(
      JSON.stringify({ sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
