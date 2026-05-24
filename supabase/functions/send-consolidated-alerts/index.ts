import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// This edge function is designed to be triggered via pg_cron every 4 hours.
// It pulls all check-ins and medications missed in the last 4 hours and sends a consolidated MSG91 SMS.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();
    // Look back exactly 4 hours
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    // 1. Fetch missed check-ins in the last 4 hours
    const { data: checkIns, error: ciError } = await supabase
      .from("check_ins")
      .select("id, user_id, scheduled_at, status")
      .eq("status", "missed")
      .gte("scheduled_at", fourHoursAgo.toISOString())
      .lte("scheduled_at", now.toISOString());

    if (ciError) throw ciError;

    // 2. Fetch missed medications in the last 4 hours
    const { data: medLogs, error: mlError } = await supabase
      .from("medication_logs")
      .select("id, user_id, scheduled_at, status, medication:medications(name)")
      .eq("status", "missed")
      .gte("scheduled_at", fourHoursAgo.toISOString())
      .lte("scheduled_at", now.toISOString());

    if (mlError) throw mlError;

    if ((!checkIns || checkIns.length === 0) && (!medLogs || medLogs.length === 0)) {
      return new Response(JSON.stringify({ message: "No missed events in the last 4 hours" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Group by User ID
    const userEvents = new Map<string, { checkIns: any[]; meds: any[] }>();

    (checkIns || []).forEach(ci => {
      if (!userEvents.has(ci.user_id)) userEvents.set(ci.user_id, { checkIns: [], meds: [] });
      userEvents.get(ci.user_id)!.checkIns.push(ci);
    });

    (medLogs || []).forEach(ml => {
      if (!userEvents.has(ml.user_id)) userEvents.set(ml.user_id, { checkIns: [], meds: [] });
      userEvents.get(ml.user_id)!.meds.push(ml);
    });

    let smsSent = 0;
    const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
    // We can reuse the generic template if we want, or a consolidated template.
    // For now we will use MSG91_CHECKIN_TEMPLATE_ID or a similar dynamic template if available.
    // In production, you would map this to an approved MSG91 DLT template that accepts a dynamic `message` variable.
    const msg91Template = Deno.env.get("MSG91_CHECKIN_TEMPLATE_ID") || "REPLACE_WITH_CONSOLIDATED_TEMPLATE_ID";

    // Process each user
    for (const [userId, events] of userEvents.entries()) {
      // Get User Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();
        
      const userName = profile?.full_name || "Your ward";

      // Build the message string
      const lines = [];
      if (events.meds.length > 0) {
        const medNames = Array.from(new Set(events.meds.map(m => m.medication?.name || "Medication"))).join(", ");
        lines.push(`Medications: ${medNames}`);
      }
      if (events.checkIns.length > 0) {
        lines.push(`${events.checkIns.length} scheduled check-in(s)`);
      }
      
      const consolidatedMessage = `${userName} has missed the following events in the last 4 hours: ${lines.join(" | ")}. Please reach out to ensure they are okay.`;

      // Get Guardians
      const { data: guardians } = await supabase
        .from("guardians")
        .select("guardian_phone")
        .eq("user_id", userId)
        .eq("status", "accepted");

      if (guardians && guardians.length > 0 && msg91AuthKey) {
        const recipients = guardians
          .filter((g: any) => g.guardian_phone)
          .map((g: any) => {
            const clean = g.guardian_phone.replace(/[^0-9]/g, "");
            const mobile = clean.startsWith("91") ? clean : `91${clean}`;
            return { mobiles: mobile, user_name: userName, message: consolidatedMessage };
          });

        if (recipients.length > 0) {
          try {
            const res = await fetch("https://control.msg91.com/api/v5/flow", {
              method: "POST",
              headers: { "Content-Type": "application/json", authkey: msg91AuthKey },
              body: JSON.stringify({ template_id: msg91Template, short_url: "0", recipients }),
            });
            if (res.ok) smsSent++;
          } catch (e) {
            console.error("MSG91 consolidated alert error:", e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      message: "Successfully processed consolidated alerts",
      usersAlerted: userEvents.size,
      smsDispatched: smsSent 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
