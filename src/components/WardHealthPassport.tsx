import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ACTIVITY_GOALS } from "@/hooks/useUserSettings";
import HealthPassportTrend from "./HealthPassportTrend";

interface CategoryScore {
  name: string;
  score: number;
  max: 100;
}

const CHECK_IN_HOURS = [7, 12, 19];

const getBarColor = (score: number) => {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-amber-500";
  return "bg-destructive";
};

interface WardHealthPassportProps {
  wardUserId: string;
  wardName: string;
}

const WardHealthPassport = ({ wardUserId, wardName }: WardHealthPassportProps) => {
  const [categories, setCategories] = useState<CategoryScore[]>([
    { name: "Check-iN", score: 0, max: 100 },
    { name: "Activity", score: 0, max: 100 },
    { name: "Wellness", score: 0, max: 100 },
    { name: "Medications", score: 0, max: 100 },
    { name: "Vitals", score: 0, max: 100 },
    { name: "Nutrition", score: 0, max: 100 },
  ]);
  const [overallScore, setOverallScore] = useState(0);

  const computeScores = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const currentHour = now.getHours();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const [checkInsRes, activityRes, wellnessSleepRes, wellnessTodayRes, medsRes, medLogsRes, mealLogsRes, nutritionPersonaRes, faceScanRes] = await Promise.all([
      supabase.from("check_ins").select("scheduled_at, status, response").eq("user_id", wardUserId).gte("scheduled_at", `${today}T00:00:00`).lte("scheduled_at", `${today}T23:59:59`),
      supabase.from("activity_logs").select("steps, distance_km, calories, active_minutes, heart_rate, spo2, bp_systolic, bp_diastolic, temperature_c, glucose_mg_dl").eq("user_id", wardUserId).eq("log_date", today).maybeSingle(),
      supabase.from("wellness_logs").select("sleep_hours, sleep_quality").eq("user_id", wardUserId).eq("log_date", yesterdayStr).maybeSingle(),
      supabase.from("wellness_logs").select("mood_score, energy_level, mindfulness_minutes").eq("user_id", wardUserId).eq("log_date", today).maybeSingle(),
      supabase.from("medications").select("id, schedule_times").eq("user_id", wardUserId).lte("start_date", today),
      supabase.from("medication_logs").select("medication_id, status").eq("user_id", wardUserId).gte("scheduled_at", `${today}T00:00:00`).lte("scheduled_at", `${today}T23:59:59`),
      supabase.from("meal_logs").select("total_calories, total_protein_g").eq("user_id", wardUserId).eq("log_date", today),
      supabase.from("nutrition_personas").select("daily_calorie_goal").eq("user_id", wardUserId).maybeSingle(),
      supabase.from("face_scans").select("heart_rate, stress_score").eq("user_id", wardUserId).gte("scanned_at", `${today}T00:00:00`).order("scanned_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    // 1. Check-iN
    const checkIns = checkInsRes.data ?? [];
    const passedWindows = CHECK_IN_HOURS.filter(h => currentHour >= h);
    let checkInScore = 0;
    if (passedWindows.length > 0) {
      const pointsPerWindow = 100 / 3;
      const responded = checkIns.filter(ci => ci.status === "responded" || ci.response === "ok").length;
      checkInScore = Math.min(Math.round(responded * pointsPerWindow), 100);
    }

    // 2. Activity
    const act = activityRes.data;
    let activityScore = 0;
    if (act) {
      const g = DEFAULT_ACTIVITY_GOALS;
      const stepsP = Math.min((act.steps ?? 0) / g.steps, 1) * 25;
      const distP = Math.min((Number(act.distance_km) || 0) / g.distance_km, 1) * 25;
      const calP = Math.min((act.calories ?? 0) / g.calories, 1) * 25;
      const activeP = Math.min((act.active_minutes ?? 0) / g.active_minutes, 1) * 25;
      activityScore = Math.round(stepsP + distP + calP + activeP);
    }

    // 3. Wellness
    const sleepHours = Number(wellnessSleepRes.data?.sleep_hours) || 0;
    const sleepQuality = Number(wellnessSleepRes.data?.sleep_quality) || 0;
    const moodScore = Number(wellnessTodayRes.data?.mood_score) || 0;
    const energyLevel = Number(wellnessTodayRes.data?.energy_level) || 0;
    const mindfulnessMin = Number(wellnessTodayRes.data?.mindfulness_minutes) || 0;
    const wellnessScore = Math.round(
      Math.min(sleepHours / 8, 1) * 20 +
      Math.min(sleepQuality / 5, 1) * 20 +
      Math.min(moodScore / 5, 1) * 20 +
      Math.min(energyLevel / 5, 1) * 20 +
      Math.min(mindfulnessMin / 15, 1) * 20
    );

    // 4. Medications
    const meds = medsRes.data ?? [];
    const logs = medLogsRes.data ?? [];
    let totalDoses = 0;
    meds.forEach(m => { totalDoses += (m.schedule_times?.length ?? 0); });
    const medScore = totalDoses > 0
      ? Math.round(Math.min(logs.filter(l => l.status === "taken").length / totalDoses, 1) * 100)
      : 100;

    // 5. Vitals Score — with face scan fallback
    const faceScan = faceScanRes.data;
    let vitalsScore = 0;
    if (act || faceScan) {
      const hr = (act?.heart_rate ?? 0) || (faceScan?.heart_rate ?? 0);
      if (hr > 0) vitalsScore += (hr >= 50 && hr <= 100) ? 20 : 10;

      const spo2 = Number(act?.spo2) || 0;
      if (spo2 > 0) vitalsScore += spo2 > 95 ? 20 : spo2 > 90 ? 10 : 5;

      const sys = act?.bp_systolic; const dia = act?.bp_diastolic;
      if (sys && dia) vitalsScore += (sys >= 90 && sys <= 140 && dia >= 60 && dia <= 90) ? 20 : 10;

      const temp = Number(act?.temperature_c);
      if (temp > 0) vitalsScore += (temp >= 36 && temp <= 37.5) ? 20 : 10;

      const glu = act?.glucose_mg_dl;
      if (glu && glu > 0) vitalsScore += (glu >= 70 && glu <= 140) ? 20 : 10;

      if (faceScan?.stress_score != null && faceScan.stress_score > 0) {
        const stressNorm = Math.max(0, 100 - faceScan.stress_score);
        if (!sys && !dia) vitalsScore += Math.round((stressNorm / 100) * 20);
      }
    }

    // 6. Nutrition Score
    const meals = mealLogsRes.data ?? [];
    let nutritionScore = 0;
    if (meals.length >= 1) nutritionScore += 30;
    if (meals.length >= 2) nutritionScore += 20;
    const totalCalToday = meals.reduce((s, m) => s + (m.total_calories || 0), 0);
    const calGoal = nutritionPersonaRes.data?.daily_calorie_goal || 2000;
    if (totalCalToday > 0 && Math.abs(totalCalToday - calGoal) <= calGoal * 0.2) nutritionScore += 25;
    const totalProteinToday = meals.reduce((s, m) => s + (Number(m.total_protein_g) || 0), 0);
    const proteinCalPct = totalCalToday > 0 ? (totalProteinToday * 4 / totalCalToday) * 100 : 0;
    if (proteinCalPct >= 10) nutritionScore += 25;

    const newCategories: CategoryScore[] = [
      { name: "Check-iN", score: checkInScore, max: 100 },
      { name: "Activity", score: activityScore, max: 100 },
      { name: "Wellness", score: wellnessScore, max: 100 },
      { name: "Medications", score: medScore, max: 100 },
      { name: "Vitals", score: vitalsScore, max: 100 },
      { name: "Nutrition", score: nutritionScore, max: 100 },
    ];

    const overall = Math.round(newCategories.reduce((sum, c) => sum + c.score, 0) / 6);
    setCategories(newCategories);
    setOverallScore(overall);

    // Persist daily score (guardian upserts on behalf — RLS allows owner only, so this is a silent no-op for guardians which is fine)
    await supabase.from("health_passport_scores").upsert({
      user_id: wardUserId,
      score_date: today,
      overall,
      checkin: checkInScore,
      activity: activityScore,
      wellness: wellnessScore,
      medications: medScore,
      vitals: vitalsScore,
      nutrition: nutritionScore,
    }, { onConflict: "user_id,score_date" }).then(() => {});
  }, [wardUserId]);

  useEffect(() => {
    computeScores();
    const interval = setInterval(computeScores, 60000);
    return () => clearInterval(interval);
  }, [computeScores]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{wardName}'s Health Passport</span>
          <span className="text-sm font-normal text-muted-foreground">Daily Score</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke={overallScore >= 70 ? "hsl(var(--success))" : overallScore >= 40 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))"}
                strokeWidth="8"
                strokeDasharray={`${(overallScore / 100) * 213.6} 213.6`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold">{overallScore}</span>
            </div>
          </div>
          <div>
            <p className="text-accessible font-semibold">{overallScore}/100</p>
            <p className={`text-sm font-medium ${overallScore >= 70 ? "text-success" : overallScore >= 40 ? "text-amber-500" : "text-destructive"}`}>
              {overallScore >= 70 ? "↗ Great" : overallScore >= 40 ? "→ Steady" : "↘ Needs Attention"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-sm text-muted-foreground">{cat.score}/{cat.max}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getBarColor(cat.score)} transition-all duration-700`}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <HealthPassportTrend userId={wardUserId} />
      </CardContent>
    </Card>
  );
};

export default WardHealthPassport;
