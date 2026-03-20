import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings, DEFAULT_ACTIVITY_GOALS } from "@/hooks/useUserSettings";
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface CategoryScore {
  name: string;
  score: number;
  max: 100;
  action?: string;
}

interface MilestoneConfig {
  threshold: number;
  emoji: string;
  message: string;
}

const MILESTONES: MilestoneConfig[] = [
  { threshold: 50, emoji: "🌟", message: "Halfway there! Keep going!" },
  { threshold: 70, emoji: "🎯", message: "Amazing progress! You're on fire!" },
  { threshold: 100, emoji: "🏆", message: "Perfect score! You're a health champion!" },
];

const CHECK_IN_HOURS = [7, 12, 19];

const getBarColor = (score: number) => {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-amber-500";
  return "bg-destructive";
};

const HealthPassport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useUserSettings();
  const goals = settings.activityGoals ?? DEFAULT_ACTIVITY_GOALS;
  const [categories, setCategories] = useState<CategoryScore[]>([
    { name: "Check-iN", score: 0, max: 100 },
    { name: "Face Scan", score: 0, max: 100, action: "Start Scan" },
    { name: "Activity", score: 0, max: 100 },
    { name: "Wellness", score: 0, max: 100 },
    { name: "Medications", score: 0, max: 100 },
  ]);
  const [overallScore, setOverallScore] = useState(0);
  const [activeMilestone, setActiveMilestone] = useState<MilestoneConfig | null>(null);
  const shownMilestones = useRef<Set<number>>(new Set());
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeScores = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const currentHour = now.getHours();

    // Yesterday for wellness/sleep
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Fetch all data in parallel
    const [checkInsRes, faceScansRes, activityRes, wellnessRes, medsRes, medLogsRes] = await Promise.all([
      supabase.from("check_ins").select("scheduled_at, status, response").eq("user_id", user.id).gte("scheduled_at", `${today}T00:00:00`).lte("scheduled_at", `${today}T23:59:59`),
      supabase.from("face_scans").select("id").eq("user_id", user.id).gte("scanned_at", `${today}T00:00:00`).lte("scanned_at", `${today}T23:59:59`),
      supabase.from("activity_logs").select("steps, distance_km, calories, active_minutes").eq("user_id", user.id).eq("log_date", today).maybeSingle(),
      supabase.from("wellness_logs").select("sleep_hours").eq("user_id", user.id).eq("log_date", yesterdayStr).maybeSingle(),
      supabase.from("medications").select("id, schedule_times").eq("user_id", user.id).lte("start_date", today),
      supabase.from("medication_logs").select("medication_id, status").eq("user_id", user.id).gte("scheduled_at", `${today}T00:00:00`).lte("scheduled_at", `${today}T23:59:59`),
    ]);

    // 1. Check-iN score
    const checkIns = checkInsRes.data ?? [];
    const passedWindows = CHECK_IN_HOURS.filter(h => currentHour >= h);
    let checkInScore = 0;
    if (passedWindows.length > 0) {
      const pointsPerWindow = 100 / 3;
      const responded = checkIns.filter(ci => ci.status === "responded" || ci.response === "ok").length;
      checkInScore = Math.min(Math.round(responded * pointsPerWindow), 100);
    }

    // 2. Face Scan score
    const hasScanToday = (faceScansRes.data ?? []).length > 0;
    const faceScanScore = hasScanToday ? 100 : 0;

    // 3. Activity score
    const act = activityRes.data;
    let activityScore = 0;
    if (act) {
      const stepsP = Math.min((act.steps ?? 0) / 10000, 1) * 25;
      const distP = Math.min((Number(act.distance_km) || 0) / 5, 1) * 25;
      const calP = Math.min((act.calories ?? 0) / 500, 1) * 25;
      const activeP = Math.min((act.active_minutes ?? 0) / 120, 1) * 25;
      activityScore = Math.round(stepsP + distP + calP + activeP);
    }

    // 4. Wellness score (previous night sleep)
    const sleepHours = Number(wellnessRes.data?.sleep_hours) || 0;
    const wellnessScore = Math.round(Math.min(sleepHours / 8, 1) * 100);

    // 5. Medications score
    const meds = medsRes.data ?? [];
    const logs = medLogsRes.data ?? [];
    let medScore = 0;
    // Count total scheduled doses today
    let totalDoses = 0;
    meds.forEach(m => { totalDoses += (m.schedule_times?.length ?? 0); });
    if (totalDoses > 0) {
      const takenCount = logs.filter(l => l.status === "taken").length;
      medScore = Math.round(Math.min(takenCount / totalDoses, 1) * 100);
    } else {
      medScore = 100; // No medications = full score
    }

    const newCategories: CategoryScore[] = [
      { name: "Check-iN", score: checkInScore, max: 100 },
      { name: "Face Scan", score: faceScanScore, max: 100, action: hasScanToday ? undefined : "Start Scan" },
      { name: "Activity", score: activityScore, max: 100 },
      { name: "Wellness", score: wellnessScore, max: 100 },
      { name: "Medications", score: medScore, max: 100 },
    ];

    const overall = Math.round(newCategories.reduce((sum, c) => sum + c.score, 0) / 5);

    setCategories(newCategories);
    setOverallScore(overall);

    // Check milestones
    for (const ms of MILESTONES) {
      if (overall >= ms.threshold && !shownMilestones.current.has(ms.threshold)) {
        shownMilestones.current.add(ms.threshold);
        setActiveMilestone(ms);
        if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
        milestoneTimer.current = setTimeout(() => setActiveMilestone(null), 3000);
        break;
      }
    }
  }, [user]);

  useEffect(() => {
    computeScores();
    const interval = setInterval(computeScores, 60000);
    return () => {
      clearInterval(interval);
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
    };
  }, [computeScores]);

  const handleAction = (cat: CategoryScore) => {
    if (cat.name === "Face Scan" && cat.action) {
      navigate("/my-health");
    }
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Milestone Celebration Overlay */}
      {activeMilestone && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="text-center space-y-2 animate-in zoom-in-50 duration-500">
            <span className="text-6xl block">{activeMilestone.emoji}</span>
            <p className="text-lg font-bold text-foreground">{activeMilestone.message}</p>
            <p className="text-sm text-muted-foreground">Score: {overallScore}/100</p>
          </div>
        </div>
      )}

      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Health Passport</span>
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
            <p className="text-xs text-muted-foreground">Updated just now</p>
          </div>
        </div>

        {/* Category Rows */}
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
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
              {cat.action ? (
                <button onClick={() => handleAction(cat)} className="ml-3 text-xs text-primary font-medium flex items-center">
                  {cat.action} <ChevronRight className="w-3 h-3" />
                </button>
              ) : (
                <ChevronRight className="ml-3 w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default HealthPassport;
