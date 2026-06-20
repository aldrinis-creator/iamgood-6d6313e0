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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: cron-only — require service-role bearer
    const authHeader = req.headers.get("Authorization") || "";
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);


    const now = new Date();
    // Start date is 7 days ago
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    const dateOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
    const startDateLabel = startDate.toLocaleDateString("en-US", dateOptions);
    const endDateLabel = endDate.toLocaleDateString("en-US", dateOptions);

    console.log(`Starting weekly report generation for period: ${startDateLabel} to ${endDateLabel}`);

    // 1. Fetch all user settings where weeklyReport is enabled
    const { data: allSettings, error: settingsErr } = await supabase
      .from("user_settings")
      .select("user_id, settings");

    if (settingsErr) {
      console.error("Error fetching user settings:", settingsErr);
      return new Response(JSON.stringify({ error: settingsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eligibleUsers = (allSettings || []).filter((u) => {
      const s = (u.settings as any) || {};
      return s.weeklyReport === true;
    });

    console.log(`Found ${eligibleUsers.length} users with weekly report enabled.`);

    let reportsSent = 0;

    for (const userRow of eligibleUsers) {
      const userId = userRow.user_id;

      // 2. Fetch User Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      const userName = profile?.full_name || "User";

      // 3. Fetch User Email from Auth
      let userEmail: string | undefined;
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        userEmail = authUser?.user?.email;
      } catch (err) {
        console.error(`Error fetching auth email for user ${userId}:`, err);
      }

      // 4. Fetch Guardians
      const { data: guardians } = await supabase
        .from("guardians")
        .select("id, guardian_name, guardian_email")
        .eq("user_id", userId)
        .eq("status", "accepted");

      const hasUserEmail = !!userEmail;
      const hasGuardianEmails = (guardians || []).some((g) => !!g.guardian_email);

      if (!hasUserEmail && !hasGuardianEmails) {
        console.log(`User ${userName} (${userId}) has no email and no guardians with emails. Skipping.`);
        continue;
      }

      // 5. Gather Statistics
      // 5a. Check-iNs
      const { data: checkIns } = await supabase
        .from("check_ins")
        .select("status")
        .eq("user_id", userId)
        .gte("scheduled_at", startDate.toISOString())
        .lte("scheduled_at", endDate.toISOString());

      const totalCheckIns = checkIns?.length || 0;
      const respondedCheckIns = checkIns?.filter((c) => c.status === "responded").length || 0;
      const missedCheckIns = checkIns?.filter((c) => c.status === "missed").length || 0;
      const checkInRate = totalCheckIns > 0 ? Math.round((respondedCheckIns / totalCheckIns) * 100) : 100;

      // 5b. Medications
      const { data: medLogs } = await supabase
        .from("medication_logs")
        .select("status")
        .eq("user_id", userId)
        .gte("scheduled_at", startDate.toISOString())
        .lte("scheduled_at", endDate.toISOString());

      const totalMeds = medLogs?.length || 0;
      const takenMeds = medLogs?.filter((m) => m.status === "taken" || m.status === "taken_late").length || 0;
      const missedMeds = medLogs?.filter((m) => m.status === "missed").length || 0;
      const medRate = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 100;

      // 5c. Wellness logs
      const { data: wellnessLogs } = await supabase
        .from("wellness_logs")
        .select("mood, sleep_hours, stress_level, energy_level")
        .eq("user_id", userId)
        .gte("log_date", startDate.toISOString().split("T")[0])
        .lte("log_date", endDate.toISOString().split("T")[0]);

      const sleeps = (wellnessLogs || []).map((l) => Number(l.sleep_hours) || 0).filter((s) => s > 0);
      const avgSleep = sleeps.length > 0 ? Number((sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1)) : 0;

      const stresses = (wellnessLogs || []).map((l) => Number(l.stress_level) || 0).filter((s) => s > 0);
      const avgStress = stresses.length > 0 ? Number((stresses.reduce((a, b) => a + b, 0) / stresses.length).toFixed(1)) : 3;

      const energies = (wellnessLogs || []).map((l) => Number(l.energy_level) || 0).filter((s) => s > 0);
      const avgEnergy = energies.length > 0 ? Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)) : 3;

      const moods = (wellnessLogs || []).map((l) => l.mood).filter((m) => !!m);
      const moodCounts = moods.reduce((acc, m) => {
        acc[m] = (acc[m] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      let topMood = "N/A";
      let maxCount = 0;
      for (const [m, count] of Object.entries(moodCounts)) {
        if (count > maxCount) {
          maxCount = count;
          topMood = m;
        }
      }

      // 5d. Activity logs
      const { data: activityLogs } = await supabase
        .from("activity_logs")
        .select("steps, exercise_minutes")
        .eq("user_id", userId)
        .gte("log_date", startDate.toISOString().split("T")[0])
        .lte("log_date", endDate.toISOString().split("T")[0]);

      const totalSteps = (activityLogs || []).reduce((sum, l) => sum + (l.steps || 0), 0);
      const totalExerciseMin = (activityLogs || []).reduce((sum, l) => sum + (l.exercise_minutes || 0), 0);

      // 6. Build the payload
      const reportPayload = {
        userName,
        startDate: startDateLabel,
        endDate: endDateLabel,
        checkInStats: {
          total: totalCheckIns,
          responded: respondedCheckIns,
          missed: missedCheckIns,
          rate: checkInRate,
        },
        medicationStats: {
          total: totalMeds,
          taken: takenMeds,
          missed: missedMeds,
          rate: medRate,
        },
        wellnessStats: {
          avgSleep,
          avgStress,
          avgEnergy,
          topMood,
        },
        activityStats: {
          totalSteps,
          totalExerciseMin,
        },
      };

      // 7. Send report to User if registered
      if (userEmail) {
        try {
          const idempotencyKey = `weekly-report-${userId}-user-${startDate.toISOString().split("T")[0]}`;
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "weekly-report",
              recipientEmail: userEmail,
              idempotencyKey,
              templateData: {
                ...reportPayload,
                recipientName: userName,
              },
            },
          });
          reportsSent++;
          console.log(`Successfully enqueued weekly report for user ${userEmail}`);
        } catch (err) {
          console.error(`Failed to send weekly report to user ${userEmail}:`, err);
        }
      }

      // 8. Send report to Guardians
      if (guardians) {
        for (const guardian of guardians) {
          if (!guardian.guardian_email) continue;
          try {
            const idempotencyKey = `weekly-report-${userId}-guardian-${guardian.id}-${startDate.toISOString().split("T")[0]}`;
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "weekly-report",
                recipientEmail: guardian.guardian_email,
                idempotencyKey,
                templateData: {
                  ...reportPayload,
                  recipientName: guardian.guardian_name,
                },
              },
            });
            reportsSent++;
            console.log(`Successfully enqueued weekly report for guardian ${guardian.guardian_email}`);
          } catch (err) {
            console.error(`Failed to send weekly report to guardian ${guardian.guardian_email}:`, err);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Weekly reports processed",
        usersProcessed: eligibleUsers.length,
        reportsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Weekly report generation error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
