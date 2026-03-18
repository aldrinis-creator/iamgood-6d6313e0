import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Check-in windows: 7AM, 12PM, 7PM IST
const CHECK_IN_HOURS = [7, 12, 19];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Current time in UTC
    const now = new Date();

    // Find pending check-ins that are overdue (10+ minutes past their window)
    // Window end for each check-in hour:
    // 7AM -> next is 12PM, so window ends at 12PM
    // 12PM -> next is 7PM, so window ends at 7PM  
    // 7PM -> window ends at 11:59PM
    // We mark as missed if pending and 10 min past scheduled_at + window duration

    // Simple approach: find all pending check-ins where scheduled_at < (now - 10 minutes)
    // and the next check-in window has started (meaning the window has passed)
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

    for (const checkIn of pendingCheckIns) {
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", checkIn.user_id)
        .single();

      const userName = profile?.full_name || "Your ward";

      // Get guardians for this user
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

        for (const guardian of guardians) {
          // Create in-app notification
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: checkIn.user_id,
              guardian_id: guardian.id,
              type: "missed_checkin",
              title: "Missed Check-In Alert",
              message: `${userName} missed their ${timeStr} check-in. Please reach out to make sure they're okay.`,
            });

          if (notifError) {
            console.error("Error creating notification:", notifError);
          } else {
            notificationsCreated++;
          }
        }
      }

      // Mark check-in as missed
      await supabase
        .from("check_ins")
        .update({ status: "missed" })
        .eq("id", checkIn.id);
    }

    console.log(`Created ${notificationsCreated} notifications`);

    return new Response(
      JSON.stringify({
        message: "Processed missed check-ins",
        missed: pendingCheckIns.length,
        notifications: notificationsCreated,
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
