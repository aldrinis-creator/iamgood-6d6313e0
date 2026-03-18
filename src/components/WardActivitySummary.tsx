import { useState, useEffect } from "react";
import {
  Heart, Footprints, MapPin, Activity, Flame, Timer, Wind, Building2, Droplets,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

type TrendPeriod = "daily" | "weekly" | "monthly";

interface ActivityLog {
  log_date: string;
  steps: number;
  heart_rate: number;
  distance_km: number;
  cadence: number;
  calories: number;
  active_minutes: number;
  breaths_per_min: number;
  floors_climbed: number;
  spo2: number;
  exercise_minutes: number;
  sleep_hours: number;
}

const METRICS = [
  { key: "heart_rate", label: "Heart Rate", unit: "bpm", icon: Heart, color: "text-sos" },
  { key: "steps", label: "Steps", unit: "", icon: Footprints, color: "text-primary" },
  { key: "distance_km", label: "Distance", unit: "km", icon: MapPin, color: "text-success" },
  { key: "cadence", label: "Cadence", unit: "spm", icon: Activity, color: "text-primary" },
  { key: "calories", label: "Calories", unit: "kcal", icon: Flame, color: "text-sos" },
  { key: "active_minutes", label: "Active Min", unit: "min", icon: Timer, color: "text-success" },
  { key: "breaths_per_min", label: "Breaths", unit: "/min", icon: Wind, color: "text-primary" },
  { key: "floors_climbed", label: "Floors", unit: "", icon: Building2, color: "text-success" },
  { key: "spo2", label: "SpO2", unit: "%", icon: Droplets, color: "text-sos" },
] as const;

interface Props {
  wardUserId: string;
  wardName: string;
}

const WardActivitySummary = ({ wardUserId, wardName }: Props) => {
  const [loading, setLoading] = useState(true);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("daily");
  const [data, setData] = useState<ActivityLog[]>([]);
  const [todayEntry, setTodayEntry] = useState<ActivityLog | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let startDate: string;
      if (trendPeriod === "daily") startDate = format(subDays(new Date(), 6), "yyyy-MM-dd");
      else if (trendPeriod === "weekly") startDate = format(subWeeks(new Date(), 3), "yyyy-MM-dd");
      else startDate = format(subMonths(new Date(), 5), "yyyy-MM-dd");

      const { data: rows } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", wardUserId)
        .gte("log_date", startDate)
        .order("log_date", { ascending: true });

      if (rows) {
        setData(rows as ActivityLog[]);
        const today = format(new Date(), "yyyy-MM-dd");
        setTodayEntry((rows as ActivityLog[]).find((r) => r.log_date === today) || null);
      }
      setLoading(false);
    };
    fetch();
  }, [wardUserId, trendPeriod]);

  const getValue = (key: string) => {
    if (!todayEntry) return 0;
    return Number(todayEntry[key as keyof ActivityLog] || 0);
  };

  const buildChartData = () => {
    if (trendPeriod === "daily") {
      return Array.from({ length: 7 }, (_, i) => {
        const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
        const entry = data.find((d) => d.log_date === date);
        return {
          label: format(subDays(new Date(), 6 - i), "EEE"),
          steps: entry?.steps || 0,
          heart_rate: entry?.heart_rate || 0,
          calories: entry?.calories || 0,
          spo2: entry?.spo2 || 0,
        };
      });
    }
    if (trendPeriod === "weekly") {
      return Array.from({ length: 4 }, (_, i) => {
        const ws = startOfWeek(subWeeks(new Date(), 3 - i), { weekStartsOn: 1 });
        const we = endOfWeek(subWeeks(new Date(), 3 - i), { weekStartsOn: 1 });
        const entries = data.filter((d) => { const dt = new Date(d.log_date); return dt >= ws && dt <= we; });
        const avg = (k: keyof ActivityLog) => entries.length ? Math.round(entries.reduce((s, e) => s + Number(e[k] || 0), 0) / entries.length) : 0;
        return { label: `W${format(ws, "w")}`, steps: avg("steps"), heart_rate: avg("heart_rate"), calories: avg("calories"), spo2: avg("spo2") };
      });
    }
    return Array.from({ length: 6 }, (_, i) => {
      const ms = startOfMonth(subMonths(new Date(), 5 - i));
      const me = endOfMonth(subMonths(new Date(), 5 - i));
      const entries = data.filter((d) => { const dt = new Date(d.log_date); return dt >= ms && dt <= me; });
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

  if (loading) {
    return <p className="text-center text-sm text-muted-foreground py-4">Loading activity…</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        {wardName}'s Activity
      </h2>

      {/* Today's metrics */}
      <div className="grid grid-cols-3 gap-2">
        {METRICS.map((m) => (
          <Card key={m.key}>
            <CardContent className="p-3 flex flex-col items-center gap-1">
              <m.icon className={`w-5 h-5 ${m.color}`} />
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
              <span className="text-sm font-semibold">
                {m.key === "distance_km" ? Number(getValue(m.key)).toFixed(1) : getValue(m.key).toLocaleString()}
                {m.unit && <span className="text-[10px] text-muted-foreground ml-0.5">{m.unit}</span>}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend charts */}
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
            <ChartContainer config={chartConfig} className="h-[140px] w-full">
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
            <ChartContainer config={chartConfig} className="h-[140px] w-full">
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

export default WardActivitySummary;
