import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    for (const checkIn of pendingCheckIns) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", checkIn.user_id)
        .single();

      const userName = profile?.full_name || "Your ward";

      const { data: guardians } = await supabase
        .from("guardians")
        .select("id, guardian_name, guardian_email")
        .eq("user_id", checkIn.user_id);

      if (guardians && guardians.length > 0) {
        const scheduledTime = new Date(checkIn.scheduled_at);
        const timeStr = scheduledTime.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        });

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
        }
      }

      // Mark check-in as missed
      await supabase
        .from("check_ins")
        .update({ status: "missed" })
        .eq("id", checkIn.id);
    }

    console.log(`Created ${notificationsCreated} notifications, sent ${emailsSent} emails`);

    return new Response(
      JSON.stringify({
        message: "Processed missed check-ins",
        missed: pendingCheckIns.length,
        notifications: notificationsCreated,
        emails: emailsSent,
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
