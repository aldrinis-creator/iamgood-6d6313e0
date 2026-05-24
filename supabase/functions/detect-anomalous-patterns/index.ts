import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_id } = await req.json();
    if (!user_id || user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().split("T")[0];

    const [activityRes, checkInsRes, wellnessRes] = await Promise.all([
      sb.from("activity_logs").select("log_date, steps, exercise_minutes, sleep_hours, heart_rate, spo2, calories")
        .eq("user_id", user_id).gte("log_date", fourteenDaysAgo.split("T")[0]).order("log_date"),
      sb.from("check_ins").select("scheduled_at, status, responded_at, response")
        .eq("user_id", user_id).gte("scheduled_at", fourteenDaysAgo).order("scheduled_at"),
      sb.from("wellness_logs").select("log_date, mood_score, stress_level, sleep_hours, energy_level")
        .eq("user_id", user_id).gte("log_date", fourteenDaysAgo.split("T")[0]).order("log_date"),
    ]);

    const activities = activityRes.data || [];
    const checkIns = checkInsRes.data || [];
    const wellness = wellnessRes.data || [];

    // Quick local heuristic checks
    const anomalyFlags: string[] = [];

    // Check if no activity data today
    const todayActivity = activities.filter((a) => a.log_date === today);
    if (todayActivity.length === 0 && activities.length > 3) {
      anomalyFlags.push("no_activity_today");
    }

    // Check missed check-ins
    const missedCheckIns = checkIns.filter((c) => c.status === "missed");
    const recentMissed = missedCheckIns.filter(
      (c) => new Date(c.scheduled_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );
    if (recentMissed.length >= 2) {
      anomalyFlags.push("multiple_missed_checkins");
    }

    // Check declining wellness trend
    if (wellness.length >= 3) {
      const recent3 = wellness.slice(-3);
      const avgMood = recent3.reduce((a, w) => a + (w.mood_score || 0), 0) / 3;
      const older = wellness.slice(0, -3);
      if (older.length > 0) {
        const olderAvgMood = older.reduce((a, w) => a + (w.mood_score || 0), 0) / older.length;
        if (avgMood < olderAvgMood - 2) anomalyFlags.push("declining_mood");
      }
    }

    // Check abnormal vitals
    if (activities.length >= 3) {
      const recentHR = activities.filter((a) => a.heart_rate).slice(-3);
      const avgHR = recentHR.length > 0 
        ? recentHR.reduce((a, r) => a + (r.heart_rate || 0), 0) / recentHR.length 
        : 0;
      if (avgHR > 100) anomalyFlags.push("elevated_heart_rate");
      
      const recentSpo2 = activities.filter((a) => a.spo2).slice(-3);
      const avgSpo2 = recentSpo2.length > 0
        ? recentSpo2.reduce((a, r) => a + (r.spo2 || 0), 0) / recentSpo2.length
        : 100;
      if (avgSpo2 < 94) anomalyFlags.push("low_spo2");
    }

    // If no anomaly flags, return early without calling AI
    if (anomalyFlags.length === 0) {
      return new Response(JSON.stringify({ anomalies_detected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to generate a natural language summary
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        anomalies_detected: true,
        severity: anomalyFlags.includes("low_spo2") || anomalyFlags.includes("elevated_heart_rate") ? "high" : "medium",
        summary: `Detected: ${anomalyFlags.join(", ").replace(/_/g, " ")}`,
        flags: anomalyFlags,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiPayload = {
      flags: anomalyFlags,
      recent_activity: activities.slice(-7),
      recent_wellness: wellness.slice(-5),
      missed_checkins_24h: recentMissed.length,
      today,
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        reasoning: { effort: "low" },
        messages: [
          {
            role: "system",
            content: `You are a health monitoring assistant. Given anomaly flags and user health data, write a brief (2-3 sentence), caring, non-alarming summary for the user explaining what pattern deviation was detected and what they might consider doing. Do not diagnose. Be warm and supportive. Output plain text only.`,
          },
          { role: "user", content: JSON.stringify(aiPayload) },
        ],
      }),
    });

    let summary = `Unusual patterns detected: ${anomalyFlags.join(", ").replace(/_/g, " ")}`;
    if (aiResp.ok) {
      const aiData = await aiResp.json();
      summary = aiData.choices?.[0]?.message?.content || summary;
    }

    const severity = anomalyFlags.some((f) => ["low_spo2", "elevated_heart_rate"].includes(f))
      ? "high" : "medium";

    return new Response(JSON.stringify({
      anomalies_detected: true,
      severity,
      summary,
      flags: anomalyFlags,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-anomalous-patterns error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
