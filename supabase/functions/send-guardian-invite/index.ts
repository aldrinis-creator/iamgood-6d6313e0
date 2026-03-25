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
    const { guardian_email, guardian_name, user_name, relation } = await req.json();

    if (!guardian_email || !guardian_name || !user_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const relationText = relation ? ` (${relation})` : "";
    const subject = `${user_name} has nominated you as their Guardian on Check-iN`;

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
        
        <p style="font-size: 14px; color: #555;">
          This nomination has been <strong>auto-accepted</strong>. If you did not expect this, you can reject it by contacting us within 24 hours.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://iamgood.lovable.app/register" 
             style="background: #1a365d; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Create Your Guardian Account
          </a>
        </div>
        
        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px;">
          Check-iN — Personal Emergency Response System<br/>
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

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
