import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  wardUserId: string;
  wardName: string;
}

interface DayData {
  day: string;
  taken: number;
  missed: number;
  total: number;
  pct: number;
}

const chartConfig = {
  taken: { label: "Taken", color: "hsl(var(--success))" },
  missed: { label: "Missed", color: "hsl(var(--destructive))" },
};

const WardMedicationAdherence = ({ wardUserId, wardName }: Props) => {
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const [{ data: meds }, { data: logs }] = await Promise.all([
        supabase
          .from("medications")
          .select("id, schedule_times")
          .eq("user_id", wardUserId),
        supabase
          .from("medication_logs")
          .select("medication_id, status, scheduled_at")
          .eq("user_id", wardUserId)
          .gte("scheduled_at", start.toISOString()),
      ]);

      const totalDailyDoses = (meds || []).reduce(
        (sum, m: any) => sum + ((m.schedule_times as string[])?.length || 0),
        0
      );

      const days: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short" });

        const dayLogs = (logs || []).filter(
          (l: any) => l.scheduled_at?.slice(0, 10) === dateStr
        );
        const taken = dayLogs.filter((l: any) => l.status === "taken").length;
        const missed = dayLogs.filter(
          (l: any) => l.status === "missed" || l.status === "skipped"
        ).length;
        const total = Math.max(totalDailyDoses, taken + missed);
        const pct = total > 0 ? Math.round((taken / total) * 100) : 0;

        days.push({ day: dayLabel, taken, missed, total, pct });
      }

      setWeekData(days);
      setLoading(false);
    };

    load();
  }, [wardUserId]);

  const avgPct = useMemo(() => {
    const valid = weekData.filter((d) => d.total > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((s, d) => s + d.pct, 0) / valid.length);
  }, [weekData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          Loading adherence data…
        </CardContent>
      </Card>
    );
  }

  if (weekData.every((d) => d.total === 0)) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Weekly Adherence
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {wardName}'s 7-day average:{" "}
          <span
            className={`font-semibold ${
              avgPct >= 80
                ? "text-success"
                : avgPct >= 50
                ? "text-amber-500"
                : "text-destructive"
            }`}
          >
            {avgPct}%
          </span>
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={weekData} barGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis hide />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) =>
                    `${value} ${name === "taken" ? "taken" : "missed"}`
                  }
                />
              }
            />
            <Bar
              dataKey="taken"
              stackId="a"
              fill="var(--color-taken)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="missed"
              stackId="a"
              fill="var(--color-missed)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default WardMedicationAdherence;
