import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { requestMotionPermission } from "@/hooks/useFallDetection";
import {
  Heart, Footprints, MapPin, Activity, Flame, Timer, Wind, Building2, Droplets,
  TrendingUp, Save, Target, Play, Pause, Square, Watch, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings, DEFAULT_ACTIVITY_GOALS, type ActivityGoals } from "@/hooks/useUserSettings";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays, subWeeks, subMonths, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";

const EXERCISE_TYPES = ["Walking", "Running", "Yoga", "Cycling", "Swimming", "Gym", "Other"] as const;

const CALORIE_RATES: Record<string, number> = {
  Walking: 4, Running: 10, Yoga: 3, Cycling: 8, Swimming: 9, Gym: 6, Other: 5,
};

// MET values per exercise type
const MET_VALUES: Record<string, number> = {
  Walking: 3.5, Running: 8.0, Yoga: 2.5, Cycling: 6.0, Swimming: 7.0, Gym: 5.0, Other: 4.0,
};

type TrendPeriod = "daily" | "weekly" | "monthly";

interface ActivityLog {
  id: string;
  log_date: string;
  steps: number;
  exercise_minutes: number;
  exercise_type: string | null;
  sleep_hours: number;
  heart_rate: number;
  distance_km: number;
  cadence: number;
  calories: number;
  active_minutes: number;
  breaths_per_min: number;
  floors_climbed: number;
  spo2: number;
  notes: string | null;
  created_at?: string;
}

// Session live metrics tracked by sensors
interface LiveMetrics {
  heartRate: number;
  steps: number;
  distance: number; // meters
  cadence: number;
  calories: number;
  activeMinutes: number;
  mets: number;
  breathsPerMin: number;
  spo2: number;
  floorsClimbed: number;
  heartRateMin: number;
  heartRateMax: number;
  heartRateSum: number;
  heartRateSamples: number;
}

const INITIAL_LIVE: LiveMetrics = {
  heartRate: 0, steps: 0, distance: 0, cadence: 0, calories: 0,
  activeMinutes: 0, mets: 0, breathsPerMin: 0, spo2: 0, floorsClimbed: 0,
  heartRateMin: 999, heartRateMax: 0, heartRateSum: 0, heartRateSamples: 0,
};

const LIVE_METRICS_LAYOUT = [
  { key: "heartRate", label: "BPM", icon: Heart, color: "text-sos" },
  { key: "steps", label: "Steps", icon: Footprints, color: "text-primary" },
  { key: "distance", label: "Distance", icon: MapPin, color: "text-primary", format: (v: number) => v < 1000 ? `${Math.round(v)} m` : `${(v / 1000).toFixed(2)} km` },
  { key: "cadence", label: "Cadence\n(steps/min)", icon: Timer, color: "text-primary" },
  { key: "calories", label: "Calories Burned", icon: Flame, color: "text-primary" },
  { key: "activeMinutes", label: "Active Minutes", icon: Timer, color: "text-primary" },
  { key: "mets", label: "METs", icon: TrendingUp, color: "text-primary" },
  { key: "breathsPerMin", label: "Breaths/min", icon: Wind, color: "text-primary" },
  { key: "spo2", label: "SpO2 %", icon: Droplets, color: "text-primary" },
  { key: "floorsClimbed", label: "Floors Climbed", icon: Building2, color: "text-primary" },
] as const;

const METRIC_DEFS = [
  { key: "heart_rate" as const, label: "Heart Rate", unit: "bpm", icon: Heart, color: "text-sos", stroke: "hsl(var(--sos))" },
  { key: "steps" as const, label: "Steps", unit: "", icon: Footprints, color: "text-primary", stroke: "hsl(var(--primary))" },
  { key: "distance_km" as const, label: "Distance", unit: "km", icon: MapPin, color: "text-success", stroke: "hsl(var(--success))" },
  { key: "cadence" as const, label: "Cadence", unit: "spm", icon: Activity, color: "text-primary", stroke: "hsl(var(--primary))" },
  { key: "calories" as const, label: "Calories", unit: "kcal", icon: Flame, color: "text-sos", stroke: "hsl(var(--sos))" },
  { key: "active_minutes" as const, label: "Active Min", unit: "min", icon: Timer, color: "text-success", stroke: "hsl(var(--success))" },
  { key: "breaths_per_min" as const, label: "Breaths", unit: "/min", icon: Wind, color: "text-primary", stroke: "hsl(var(--primary))" },
  { key: "floors_climbed" as const, label: "Floors", unit: "", icon: Building2, color: "text-success", stroke: "hsl(var(--success))" },
  { key: "spo2" as const, label: "SpO2", unit: "%", icon: Droplets, color: "text-sos", stroke: "hsl(var(--sos))" },
];

const RadialProgress = ({ value, goal, stroke }: { value: number; goal: number; stroke: string }) => {
  const pct = Math.min(value / goal, 1);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const isComplete = value >= goal;
  return (
    <svg width="40" height="40" className="absolute inset-0 m-auto">
      <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={isComplete ? "hsl(var(--success))" : stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 20 20)" className="transition-all duration-500" />
    </svg>
  );
};

// Step detection using accelerometer
function useStepCounter(active: boolean) {
  const stepsRef = useRef(0);
  const lastAccRef = useRef<number[]>([]);
  const lastPeakRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    stepsRef.current = 0;

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
      const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      const buf = lastAccRef.current;
      buf.push(mag);
      if (buf.length > 5) buf.shift();
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      const now = Date.now();
      // Detect step: magnitude spike above threshold with cooldown
      if (mag > avg + 2.5 && now - lastPeakRef.current > 300) {
        lastPeakRef.current = now;
        stepsRef.current++;
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [active]);

  return stepsRef;
}

// Simulated heart rate from motion intensity
function useMotionHeartRate(active: boolean) {
  const hrRef = useRef(0);
  const intensityRef = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
      const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      const buf = intensityRef.current;
      buf.push(mag);
      if (buf.length > 30) buf.shift();
      const avgIntensity = buf.reduce((a, b) => a + b, 0) / buf.length;
      // Map motion intensity to estimated HR: resting 72, max ~160
      const estimatedHR = Math.round(72 + Math.min(avgIntensity * 8, 88));
      hrRef.current = estimatedHR;
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [active]);

  return hrRef;
}

const ActivityTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings, updateSetting } = useUserSettings();
  const goals = settings.activityGoals ?? DEFAULT_ACTIVITY_GOALS;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("daily");
  const [trendData, setTrendData] = useState<ActivityLog[]>([]);
  const [showGoals, setShowGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<ActivityGoals>(goals);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionExerciseType, setSessionExerciseType] = useState("Walking");
  const [live, setLive] = useState<LiveMetrics>({ ...INITIAL_LIVE });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveRef = useRef<LiveMetrics>({ ...INITIAL_LIVE });

  const stepsRef = useStepCounter(sessionActive && !sessionPaused);
  const hrRef = useMotionHeartRate(sessionActive && !sessionPaused);

  useEffect(() => { setGoalDraft(goals); }, [JSON.stringify(goals)]);

  // Main timer + sensor polling
  useEffect(() => {
    if (sessionActive && !sessionPaused) {
      timerRef.current = setInterval(() => {
        setSessionElapsed((prev) => {
          const elapsed = prev + 1;
          const minutes = elapsed / 60;
          const steps = stepsRef.current;
          const hr = hrRef.current;
          const calorieRate = CALORIE_RATES[sessionExerciseType] ?? 5;
          const strideM = sessionExerciseType === "Running" ? 0.78 : 0.65;
          const distance = steps * strideM;
          const cadence = minutes > 0 ? Math.round(steps / minutes) : 0;
          const mets = MET_VALUES[sessionExerciseType] ?? 4.0;
          // Scale METs by motion intensity
          const motionMets = hr > 0 ? Math.min(mets * (hr / 100), 15) : mets;

          const updated: LiveMetrics = {
            heartRate: hr,
            steps,
            distance,
            cadence,
            calories: Math.round(minutes * calorieRate),
            activeMinutes: Math.floor(minutes),
            mets: Number(motionMets.toFixed(1)),
            breathsPerMin: hr > 0 ? Math.round(hr / 4.5) : 0,
            spo2: 0, // requires dedicated sensor
            floorsClimbed: 0, // requires barometer
            heartRateMin: hr > 0 ? Math.min(liveRef.current.heartRateMin === 999 ? hr : liveRef.current.heartRateMin, hr) : liveRef.current.heartRateMin,
            heartRateMax: Math.max(liveRef.current.heartRateMax, hr),
            heartRateSum: liveRef.current.heartRateSum + (hr > 0 ? hr : 0),
            heartRateSamples: liveRef.current.heartRateSamples + (hr > 0 ? 1 : 0),
          };
          liveRef.current = updated;
          setLive({ ...updated });
          return elapsed;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionActive, sessionPaused, sessionExerciseType]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleStartSession = async () => {
    // Request iOS motion permission (no-op on Android/desktop)
    const perm = await requestMotionPermission();
    if (perm === "denied") {
      toast({
        title: "Motion Sensors Blocked",
        description: "Please allow motion sensor access in your browser settings to track activity.",
        variant: "destructive",
      });
      return;
    }
    setSessionActive(true);
    setSessionPaused(false);
    setSessionElapsed(0);
    liveRef.current = { ...INITIAL_LIVE };
    setLive({ ...INITIAL_LIVE });
    if (showGoals) setShowGoals(false);
    toast({ title: "Session Started", description: "Sensors active — tracking your activity!" });
  };

  const handleStopSession = async () => {
    setSessionActive(false);
    setSessionPaused(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const snap = { ...liveRef.current };
    const minutes = Math.round(sessionElapsed / 60);
    const avgHr = snap.heartRateSamples > 0 ? Math.round(snap.heartRateSum / snap.heartRateSamples) : 0;

    // Save to DB
    if (user) {
      setSaving(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const payload = {
        steps: snap.steps,
        exercise_minutes: minutes,
        exercise_type: sessionExerciseType,
        heart_rate: avgHr,
        distance_km: Number((snap.distance / 1000).toFixed(2)),
        cadence: snap.cadence,
        calories: snap.calories,
        active_minutes: snap.activeMinutes,
        breaths_per_min: snap.breathsPerMin,
        floors_climbed: snap.floorsClimbed,
        spo2: snap.spo2,
        sleep_hours: 0,
        notes: `${sessionExerciseType} session — ${formatTimer(sessionElapsed)}`,
      };

      try {
        const { data: existing } = await supabase
          .from("activity_logs")
          .select("id, steps, calories, active_minutes, exercise_minutes, distance_km")
          .eq("user_id", user.id)
          .eq("log_date", today)
          .maybeSingle();

        if (existing) {
          // Accumulate on top of existing
          await supabase.from("activity_logs").update({
            ...payload,
            steps: existing.steps + payload.steps,
            calories: existing.calories + payload.calories,
            active_minutes: existing.active_minutes + payload.active_minutes,
            exercise_minutes: existing.exercise_minutes + payload.exercise_minutes,
            distance_km: Number(existing.distance_km) + payload.distance_km,
          }).eq("id", existing.id);
        } else {
          await supabase.from("activity_logs").insert({ user_id: user.id, log_date: today, ...payload });
        }

        toast({
          title: "Session Complete",
          description: `${formatTimer(sessionElapsed)} — ${snap.steps} steps, ~${snap.calories} kcal`,
        });
        fetchData();
      } catch {
        toast({ title: "Error", description: "Failed to save session.", variant: "destructive" });
      } finally {
        setSaving(false);
      }
    }
    setSessionElapsed(0);
    liveRef.current = { ...INITIAL_LIVE };
    setLive({ ...INITIAL_LIVE });
  };

  const METRICS = useMemo(() => METRIC_DEFS.map(m => ({ ...m, goal: goals[m.key] })), [goals]);

  // Form state for today's data (read from DB)
  const [form, setForm] = useState({
    steps: 0, exercise_minutes: 0, exercise_type: "", sleep_hours: 0,
    heart_rate: 0, distance_km: 0, cadence: 0, calories: 0,
    active_minutes: 0, breaths_per_min: 0, floors_climbed: 0, spo2: 0,
    notes: "",
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    let startDate: string;
    if (trendPeriod === "daily") startDate = format(subDays(new Date(), 6), "yyyy-MM-dd");
    else if (trendPeriod === "weekly") startDate = format(subWeeks(new Date(), 3), "yyyy-MM-dd");
    else startDate = format(subMonths(new Date(), 5), "yyyy-MM-dd");

    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", startDate)
      .order("log_date", { ascending: true });

    if (data) {
      setTrendData(data as ActivityLog[]);
      const today = format(new Date(), "yyyy-MM-dd");
      const todayEntry = data.find((d: any) => d.log_date === today);
      if (todayEntry) {
        setForm({
          steps: todayEntry.steps, exercise_minutes: todayEntry.exercise_minutes,
          exercise_type: todayEntry.exercise_type || "", sleep_hours: todayEntry.sleep_hours,
          heart_rate: todayEntry.heart_rate, distance_km: todayEntry.distance_km,
          cadence: todayEntry.cadence, calories: todayEntry.calories,
          active_minutes: todayEntry.active_minutes, breaths_per_min: todayEntry.breaths_per_min,
          floors_climbed: todayEntry.floors_climbed, spo2: todayEntry.spo2,
          notes: todayEntry.notes || "",
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, trendPeriod]);

  const buildChartData = () => {
    if (trendPeriod === "daily") {
      return Array.from({ length: 7 }, (_, i) => {
        const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
        const entry = trendData.find((d) => d.log_date === date);
        return { label: format(subDays(new Date(), 6 - i), "EEE"), steps: entry?.steps || 0, heart_rate: entry?.heart_rate || 0, calories: entry?.calories || 0, spo2: entry?.spo2 || 0 };
      });
    }
    if (trendPeriod === "weekly") {
      return Array.from({ length: 4 }, (_, i) => {
        const ws = startOfWeek(subWeeks(new Date(), 3 - i), { weekStartsOn: 1 });
        const we = endOfWeek(subWeeks(new Date(), 3 - i), { weekStartsOn: 1 });
        const entries = trendData.filter((d) => { const dt = new Date(d.log_date); return dt >= ws && dt <= we; });
        const avg = (k: keyof ActivityLog) => entries.length ? Math.round(entries.reduce((s, e) => s + Number(e[k] || 0), 0) / entries.length) : 0;
        return { label: `W${format(ws, "w")}`, steps: avg("steps"), heart_rate: avg("heart_rate"), calories: avg("calories"), spo2: avg("spo2") };
      });
    }
    return Array.from({ length: 6 }, (_, i) => {
      const ms = startOfMonth(subMonths(new Date(), 5 - i));
      const me = endOfMonth(subMonths(new Date(), 5 - i));
      const entries = trendData.filter((d) => { const dt = new Date(d.log_date); return dt >= ms && dt <= me; });
      const avg = (k: keyof ActivityLog) => entries.length ? Math.round(entries.reduce((s, e) => s + Number(e[k] || 0), 0) / entries.length) : 0;
      return { label: format(ms, "MMM"), steps: avg("steps"), heart_rate: avg("heart_rate"), calories: avg("calories"), spo2: avg("spo2") };
    });
  };

  const chartData = buildChartData();
  const chartConfig = {
    steps: { label: "Steps", color: "hsl(var(--primary))" },
    heart_rate: { label: "Heart Rate", color: "hsl(var(--sos))" },
    calories: { label: "Calories", color: "hsl(var(--success))" },
    spo2: { label: "SpO2 %", color: "hsl(160, 84%, 50%)" },
  };

  const getValue = (key: string) => {
    const val = form[key as keyof typeof form];
    return typeof val === "number" ? val : 0;
  };

  // Recent activities (last 7 entries excluding today)
  const recentActivities = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return trendData.filter(d => d.log_date !== today && (d.steps > 0 || d.calories > 0)).slice(-7).reverse();
  }, [trendData]);

  if (loading) return <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>;

  const formatLiveValue = (key: string, val: number) => {
    if (key === "distance") return val < 1000 ? `${Math.round(val)} m` : `${(val / 1000).toFixed(2)} km`;
    if (key === "mets") return val > 0 ? val.toFixed(1) : "--";
    if (key === "breathsPerMin" || key === "spo2" || key === "floorsClimbed") return val > 0 ? val.toString() : "--";
    if (key === "heartRate") return val > 0 ? val.toString() : "--";
    return val.toString();
  };

  const avgHR = live.heartRateSamples > 0 ? Math.round(live.heartRateSum / live.heartRateSamples) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Start New Activity</h2>
        <p className="text-sm text-muted-foreground">Track your heart rate, steps, distance, and duration</p>
      </div>

      {/* Main session card */}
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-4">
          {/* Status & Timer */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Activity className={`w-5 h-5 text-primary ${sessionActive ? "animate-pulse" : ""}`} />
              <span className="font-semibold text-base">{sessionActive ? `${sessionExerciseType} Session` : "Ready to Start"}</span>
            </div>
            <p className="text-5xl font-bold font-mono tracking-wider text-primary">
              {formatTimer(sessionElapsed)}
            </p>
            <p className="text-sm text-muted-foreground">Duration</p>
          </div>

          {/* Live Metrics 2-col grid */}
          <div className="grid grid-cols-2 gap-3">
            {LIVE_METRICS_LAYOUT.map((m) => {
              const val = live[m.key as keyof LiveMetrics] as number;
              const isHeart = m.key === "heartRate";
              return (
                <div
                  key={m.key}
                  className="bg-muted rounded-xl p-4 flex flex-col items-center gap-1"
                >
                  <m.icon className={`w-6 h-6 ${isHeart && val > 0 ? "text-sos" : "text-primary"}`} />
                  <span className="text-2xl font-bold tabular-nums">
                    {formatLiveValue(m.key, val)}
                  </span>
                  <span className="text-xs text-muted-foreground text-center whitespace-pre-line">{m.label}</span>
                </div>
              );
            })}
          </div>

          {/* Exercise Type selector + action buttons */}
          {!sessionActive && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Exercise Type</Label>
                <Select value={sessionExerciseType} onValueChange={setSessionExerciseType}>
                  <SelectTrigger className="h-10 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXERCISE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => toast({ title: "Wearable", description: "Connect your wearable device to sync data." })}>
                  <Watch className="w-4 h-4" />
                  Load from Wearable
                </Button>
                <Button className="flex-1 gap-2 bg-primary hover:bg-primary/90" onClick={handleStartSession}>
                  <Play className="w-4 h-4" />
                  Start Session
                </Button>
              </div>
            </div>
          )}

          {/* Session controls */}
          {sessionActive && (
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 gap-2" onClick={() => setSessionPaused(!sessionPaused)}>
                {sessionPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {sessionPaused ? "Resume" : "Pause"}
              </Button>
              <Button variant="destructive" className="flex-1 gap-2" onClick={handleStopSession} disabled={saving}>
                <Square className="w-4 h-4" />
                {saving ? "Saving…" : "Stop"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Heart Rate Bar (during session) */}
      {sessionActive && live.heartRate > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-medium">
            <span>Min: {live.heartRateMin === 999 ? "--" : live.heartRateMin} BPM</span>
            <span>Avg: {avgHR} BPM</span>
            <span>Max: {live.heartRateMax || "--"} BPM</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min((live.heartRate / 200) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Goals Editor */}
      <div className="flex gap-2">
        <Button size="sm" variant={showGoals ? "outline" : "secondary"} onClick={() => setShowGoals(!showGoals)}>
          <Target className="w-4 h-4 mr-1" />
          {showGoals ? "Close" : "Goals"}
        </Button>
      </div>

      {showGoals && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Set Daily Goals
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {METRIC_DEFS.map((m) => (
                <div key={m.key}>
                  <Label className="text-[10px]">{m.label}{m.unit ? ` (${m.unit})` : ""}</Label>
                  <Input type="number" min={1} value={goalDraft[m.key]} onChange={(e) => setGoalDraft(prev => ({ ...prev, [m.key]: Number(e.target.value) || 1 }))} className="h-9 text-sm" />
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => { updateSetting("activityGoals", goalDraft); setShowGoals(false); toast({ title: "Goals Updated" }); }}>
              <Save className="w-4 h-4 mr-2" /> Save Goals
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Activities */}
      {recentActivities.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Recent Activities
            </h3>
            <div className="space-y-2">
              {recentActivities.map((entry) => (
                <div key={entry.id} className="bg-muted rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{format(new Date(entry.log_date), "EEE, MMM d")}</p>
                    <p className="text-xs text-muted-foreground">{entry.created_at ? format(new Date(entry.created_at), "HH:mm") : ""}</p>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div className="text-center">
                      <p className="font-semibold">{entry.steps.toLocaleString()}</p>
                      <p className="text-muted-foreground">steps</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{Number(entry.distance_km).toFixed(2)} km</p>
                      <p className="text-muted-foreground">distance</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{entry.heart_rate || "--"}</p>
                      <p className="text-muted-foreground">avg BPM</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Trend */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Activity Trend</h3>
            <Tabs value={trendPeriod} onValueChange={(v) => setTrendPeriod(v as TrendPeriod)}>
              <TabsList className="h-8">
                <TabsTrigger value="daily" className="text-xs px-2 h-6">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs px-2 h-6">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-2 h-6">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Steps & Calories</p>
            <ChartContainer config={chartConfig} className="h-[160px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="steps" fill="var(--color-steps)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="calories" fill="var(--color-calories)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Heart Rate & SpO2</p>
            <ChartContainer config={chartConfig} className="h-[160px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="heart_rate" stroke="var(--color-heart_rate)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="spo2" stroke="var(--color-spo2)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityTracker;
