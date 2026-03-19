import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    { name: "Face Scan", score: 0, max: 100 },
    { name: "Activity", score: 0, max: 100 },
    { name: "Wellness", score: 0, max: 100 },
    { name: "Medications", score: 0, max: 100 },
  ]);
  const [overallScore, setOverallScore] = useState(0);

  const computeScores = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const currentHour = now.getHours();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const [checkInsRes, faceScansRes, activityRes, wellnessRes, medsRes, medLogsRes] = await Promise.all([
      supabase.from("check_ins").select("scheduled_at, status, response").eq("user_id", wardUserId).gte("scheduled_at", `${today}T00:00:00`).lte("scheduled_at", `${today}T23:59:59`),
      supabase.from("face_scans").select("id").eq("user_id", wardUserId).gte("scanned_at", `${today}T00:00:00`).lte("scanned_at", `${today}T23:59:59`),
      supabase.from("activity_logs").select("steps, distance_km, calories, active_minutes").eq("user_id", wardUserId).eq("log_date", today).maybeSingle(),
      supabase.from("wellness_logs").select("sleep_hours").eq("user_id", wardUserId).eq("log_date", yesterdayStr).maybeSingle(),
      supabase.from("medications").select("id, schedule_times").eq("user_id", wardUserId).lte("start_date", today),
      supabase.from("medication_logs").select("medication_id, status").eq("user_id", wardUserId).gte("scheduled_at", `${today}T00:00:00`).lte("scheduled_at", `${today}T23:59:59`),
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

    // 2. Face Scan
    const faceScanScore = (faceScansRes.data ?? []).length > 0 ? 100 : 0;

    // 3. Activity
    const act = activityRes.data;
    let activityScore = 0;
    if (act) {
      const stepsP = Math.min((act.steps ?? 0) / 10000, 1) * 25;
      const distP = Math.min((Number(act.distance_km) || 0) / 5, 1) * 25;
      const calP = Math.min((act.calories ?? 0) / 500, 1) * 25;
      const activeP = Math.min((act.active_minutes ?? 0) / 120, 1) * 25;
      activityScore = Math.round(stepsP + distP + calP + activeP);
    }

    // 4. Wellness
    const sleepHours = Number(wellnessRes.data?.sleep_hours) || 0;
    const wellnessScore = Math.round(Math.min(sleepHours / 8, 1) * 100);

    // 5. Medications
    const meds = medsRes.data ?? [];
    const logs = medLogsRes.data ?? [];
    let totalDoses = 0;
    meds.forEach(m => { totalDoses += (m.schedule_times?.length ?? 0); });
    const medScore = totalDoses > 0
      ? Math.round(Math.min(logs.filter(l => l.status === "taken").length / totalDoses, 1) * 100)
      : 100;

    const newCategories: CategoryScore[] = [
      { name: "Check-iN", score: checkInScore, max: 100 },
      { name: "Face Scan", score: faceScanScore, max: 100 },
      { name: "Activity", score: activityScore, max: 100 },
      { name: "Wellness", score: wellnessScore, max: 100 },
      { name: "Medications", score: medScore, max: 100 },
    ];

    const overall = Math.round(newCategories.reduce((sum, c) => sum + c.score, 0) / 5);
    setCategories(newCategories);
    setOverallScore(overall);
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
        {/* Score Ring */}
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

        {/* Category Rows */}
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
      </CardContent>
    </Card>
  );
};

export default WardHealthPassport;
