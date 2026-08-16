import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const MAX_REMINDERS = 3;
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // one reminder per day

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronHeader !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: pending, error } = await supabase
      .from("guardians")
      .select("id, user_id, guardian_name, guardian_phone, guardian_email, relation, nomination_token, nominated_at, reminder_count, last_reminder_at, ward_notified_unaccepted")
      .eq("status", "pending")
      .lt("reminder_count", MAX_REMINDERS + 1)
      .limit(200);

    if (error) throw error;

    let remindersSent = 0;
    let wardsNotified = 0;

    for (const g of pending ?? []) {
      const count = g.reminder_count ?? 0;
      const lastAt = g.last_reminder_at
        ? new Date(g.last_reminder_at).getTime()
        : new Date(g.nominated_at).getTime();
      const due = Date.now() - lastAt >= REMINDER_INTERVAL_MS;

      if (count < MAX_REMINDERS) {
        if (!due) continue;

        // Fetch the ward's name for the message
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", g.user_id)
          .maybeSingle();

        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-guardian-invite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": CRON_SECRET ?? "",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            guardian_name: g.guardian_name,
            guardian_phone: g.guardian_phone,
            guardian_email: g.guardian_email,
            relation: g.relation,
            user_name: profile?.full_name || "Your ward",
            nomination_token: g.nomination_token,
            reminder_number: count + 1,
          }),
        });
        const body = await res.text();
        console.log("[guardian-invite-reminders] reminder", {
          guardian: g.id,
          reminder: count + 1,
          status: res.status,
          body: body.slice(0, 300),
        });

        await supabase
          .from("guardians")
          .update({ reminder_count: count + 1, last_reminder_at: new Date().toISOString() })
          .eq("id", g.id);
        remindersSent++;
        continue;
      }

      // 3 reminders sent and still pending — tell the ward once.
      if (!g.ward_notified_unaccepted && due) {
        await supabase.rpc("insert_notification_deduped", {
          p_user_id: g.user_id,
          p_title: "Guardian Has Not Accepted",
          p_message: `${g.guardian_name} has not accepted your guardian invite after 3 reminders. You may want to call them, or nominate someone else.`,
          p_type: "nomination_unaccepted",
          p_guardian_id: g.id,
        });
        await supabase
          .from("guardians")
          .update({ ward_notified_unaccepted: true })
          .eq("id", g.id);
        wardsNotified++;
      }
    }

    return new Response(JSON.stringify({ remindersSent, wardsNotified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[guardian-invite-reminders] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
