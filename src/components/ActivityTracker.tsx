import { useState, useEffect } from "react";
import {
  Heart, Footprints, MapPin, Activity, Flame, Timer, Wind, Building2, Droplets,
  Moon, Dumbbell, Save,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { format, subDays, subWeeks, subMonths, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";

const EXERCISE_TYPES = ["Walking", "Running", "Yoga", "Cycling", "Swimming", "Gym", "Other"];

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
}

const METRICS = [
  { key: "heart_rate", label: "Heart Rate", unit: "bpm", icon: Heart, color: "text-sos", stroke: "hsl(var(--sos))", goal: 80 },
  { key: "steps", label: "Steps", unit: "", icon: Footprints, color: "text-primary", stroke: "hsl(var(--primary))", goal: 10000 },
  { key: "distance_km", label: "Distance", unit: "km", icon: MapPin, color: "text-success", stroke: "hsl(var(--success))", goal: 5 },
  { key: "cadence", label: "Cadence", unit: "spm", icon: Activity, color: "text-primary", stroke: "hsl(var(--primary))", goal: 160 },
  { key: "calories", label: "Calories", unit: "kcal", icon: Flame, color: "text-sos", stroke: "hsl(var(--sos))", goal: 500 },
  { key: "active_minutes", label: "Active Min", unit: "min", icon: Timer, color: "text-success", stroke: "hsl(var(--success))", goal: 120 },
  { key: "breaths_per_min", label: "Breaths", unit: "/min", icon: Wind, color: "text-primary", stroke: "hsl(var(--primary))", goal: 16 },
  { key: "floors_climbed", label: "Floors", unit: "", icon: Building2, color: "text-success", stroke: "hsl(var(--success))", goal: 10 },
  { key: "spo2", label: "SpO2", unit: "%", icon: Droplets, color: "text-sos", stroke: "hsl(var(--sos))", goal: 98 },
] as const;

const RadialProgress = ({ value, goal, stroke }: { value: number; goal: number; stroke: string }) => {
  const pct = Math.min(value / goal, 1);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const isComplete = value >= goal;
  return (
    <svg width="40" height="40" className="absolute inset-0 m-auto">
      <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke={isComplete ? "hsl(var(--success))" : stroke}
        strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
        className="transition-all duration-500"
      />
    </svg>
  );
};

const ActivityTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("daily");
  const [trendData, setTrendData] = useState<ActivityLog[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    steps: 0, exercise_minutes: 0, exercise_type: "", sleep_hours: 0,
    heart_rate: 0, distance_km: 0, cadence: 0, calories: 0,
    active_minutes: 0, breaths_per_min: 0, floors_climbed: 0, spo2: 0,
    notes: "",
  });

  const updateField = (key: string, value: number | string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    let startDate: string;
    if (trendPeriod === "daily") {
      startDate = format(subDays(new Date(), 6), "yyyy-MM-dd");
    } else if (trendPeriod === "weekly") {
      startDate = format(subWeeks(new Date(), 3), "yyyy-MM-dd");
    } else {
      startDate = format(subMonths(new Date(), 5), "yyyy-MM-dd");
    }

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
          steps: todayEntry.steps,
          exercise_minutes: todayEntry.exercise_minutes,
          exercise_type: todayEntry.exercise_type || "",
          sleep_hours: todayEntry.sleep_hours,
          heart_rate: todayEntry.heart_rate,
          distance_km: todayEntry.distance_km,
          cadence: todayEntry.cadence,
          calories: todayEntry.calories,
          active_minutes: todayEntry.active_minutes,
          breaths_per_min: todayEntry.breaths_per_min,
          floors_climbed: todayEntry.floors_climbed,
          spo2: todayEntry.spo2,
          notes: todayEntry.notes || "",
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, trendPeriod]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const today = format(new Date(), "yyyy-MM-dd");

    const { error } = await supabase
      .from("activity_logs")
      .upsert(
        {
          user_id: user.id,
          log_date: today,
          steps: form.steps,
          exercise_minutes: form.exercise_minutes,
          exercise_type: form.exercise_type || null,
          sleep_hours: form.sleep_hours,
          heart_rate: form.heart_rate,
          distance_km: form.distance_km,
          cadence: form.cadence,
          calories: form.calories,
          active_minutes: form.active_minutes,
          breaths_per_min: form.breaths_per_min,
          floors_climbed: form.floors_climbed,
          spo2: form.spo2,
          notes: form.notes || null,
        },
        { onConflict: "user_id,log_date" }
      );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Today's activity logged!" });
      setShowForm(false);
      fetchData();
    }
    setSaving(false);
  };

  // Build chart data based on trend period
  const buildChartData = () => {
    if (trendPeriod === "daily") {
      return Array.from({ length: 7 }, (_, i) => {
        const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
        const entry = trendData.find((d) => d.log_date === date);
        return {
          label: format(subDays(new Date(), 6 - i), "EEE"),
          steps: entry?.steps || 0,
          heart_rate: entry?.heart_rate || 0,
          calories: entry?.calories || 0,
          active_minutes: entry?.active_minutes || 0,
          spo2: entry?.spo2 || 0,
        };
      });
    }

    if (trendPeriod === "weekly") {
      return Array.from({ length: 4 }, (_, i) => {
        const weekStart = startOfWeek(subWeeks(new Date(), 3 - i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(subWeeks(new Date(), 3 - i), { weekStartsOn: 1 });
        const weekEntries = trendData.filter((d) => {
          const date = new Date(d.log_date);
          return date >= weekStart && date <= weekEnd;
        });
        const avg = (key: keyof ActivityLog) => {
          if (weekEntries.length === 0) return 0;
          return Math.round(weekEntries.reduce((s, e) => s + Number(e[key] || 0), 0) / weekEntries.length);
        };
        return {
          label: `W${format(weekStart, "w")}`,
          steps: avg("steps"),
          heart_rate: avg("heart_rate"),
          calories: avg("calories"),
          active_minutes: avg("active_minutes"),
          spo2: avg("spo2"),
        };
      });
    }

    // Monthly
    return Array.from({ length: 6 }, (_, i) => {
      const monthStart = startOfMonth(subMonths(new Date(), 5 - i));
      const monthEnd = endOfMonth(subMonths(new Date(), 5 - i));
      const monthEntries = trendData.filter((d) => {
        const date = new Date(d.log_date);
        return date >= monthStart && date <= monthEnd;
      });
      const avg = (key: keyof ActivityLog) => {
        if (monthEntries.length === 0) return 0;
        return Math.round(monthEntries.reduce((s, e) => s + Number(e[key] || 0), 0) / monthEntries.length);
      };
      return {
        label: format(monthStart, "MMM"),
        steps: avg("steps"),
        heart_rate: avg("heart_rate"),
        calories: avg("calories"),
        active_minutes: avg("active_minutes"),
        spo2: avg("spo2"),
      };
    });
  };

  const chartData = buildChartData();

  const chartConfig = {
    steps: { label: "Steps", color: "hsl(var(--primary))" },
    heart_rate: { label: "Heart Rate", color: "hsl(var(--sos))" },
    calories: { label: "Calories", color: "hsl(var(--success))" },
    active_minutes: { label: "Active Min", color: "hsl(213, 53%, 45%)" },
    spo2: { label: "SpO2 %", color: "hsl(160, 84%, 50%)" },
  };

  if (loading) {
    return <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>;
  }

  const getValue = (key: string) => {
    const val = form[key as keyof typeof form];
    return typeof val === "number" ? val : 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Activity Tracker
        </h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          {showForm ? "Cancel" : "Log Today"}
        </Button>
      </div>

      {/* Summary Cards — 3×3 grid */}
      <div className="grid grid-cols-3 gap-2">
        {METRICS.map((m) => (
          <Card key={m.key}>
            <CardContent className="p-3 flex flex-col items-center gap-1">
              <m.icon className={`w-5 h-5 ${m.color}`} />
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
              <span className="text-sm font-semibold">
                {m.key === "distance_km"
                  ? Number(getValue(m.key)).toFixed(1)
                  : getValue(m.key).toLocaleString()}
                {m.unit && <span className="text-[10px] text-muted-foreground ml-0.5">{m.unit}</span>}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Log Form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Log Today's Activity</h3>

            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "heart_rate", label: "Heart Rate", step: 1 },
                { key: "steps", label: "Steps", step: 100 },
                { key: "distance_km", label: "Distance (km)", step: 0.1 },
                { key: "cadence", label: "Cadence (spm)", step: 1 },
                { key: "calories", label: "Calories", step: 10 },
                { key: "active_minutes", label: "Active Min", step: 1 },
                { key: "breaths_per_min", label: "Breaths/min", step: 1 },
                { key: "floors_climbed", label: "Floors", step: 1 },
                { key: "spo2", label: "SpO2 %", step: 1 },
              ].map((f) => (
                <div key={f.key}>
                  <Label className="text-[10px]">{f.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={f.step}
                    value={getValue(f.key)}
                    onChange={(e) => updateField(f.key, Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Sleep (hrs)</Label>
                <Input
                  type="number" min={0} max={24} step={0.5}
                  value={form.sleep_hours}
                  onChange={(e) => updateField("sleep_hours", Number(e.target.value))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px]">Exercise Type</Label>
                <Select value={form.exercise_type} onValueChange={(v) => updateField("exercise_type", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {EXERCISE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Exercise (min)</Label>
                <Input
                  type="number" min={0}
                  value={form.exercise_minutes}
                  onChange={(e) => updateField("exercise_minutes", Number(e.target.value))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px]">Notes</Label>
                <Textarea rows={1} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Optional…" className="text-sm" />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save Today's Log"}
            </Button>
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

          {/* Steps & Calories bar chart */}
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

          {/* Heart Rate & SpO2 line chart */}
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
