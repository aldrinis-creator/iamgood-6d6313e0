import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getISTDateString, getISTHour } from "@/lib/istTime";
import { isMedScheduledToday } from "@/lib/medSchedule";

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
          .select("id, schedule_times, schedule_days")
          .eq("user_id", wardUserId),
        supabase
          .from("medication_logs")
          .select("medication_id, status, scheduled_at")
          .eq("user_id", wardUserId)
          .gte("scheduled_at", start.toISOString()),
      ]);

      // Today's scheduled doses so far (only count slots whose time has passed)
      const currentISTHour = getISTHour();
      const allScheduleTimes: string[] = (meds || [])
        .filter((m: any) => isMedScheduledToday(m))
        .flatMap((m: any) => (m.schedule_times as string[]) || []);
      const dosesScheduledByNowToday = allScheduleTimes.filter((t) => {
        const h = parseInt((t || "00:00").split(":")[0], 10);
        return !Number.isNaN(h) && h <= currentISTHour;
      }).length;

      const todayISTKey = getISTDateString(now);

      const days: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const istKey = getISTDateString(d);
        // Short weekday label in IST
        const dayLabel = d.toLocaleDateString("en-IN", {
          weekday: "short",
          timeZone: "Asia/Kolkata",
        });

        const dayLogs = (logs || []).filter(
          (l: any) => getISTDateString(new Date(l.scheduled_at)) === istKey
        );
        const taken = dayLogs.filter(
          (l: any) => l.status === "taken" || l.status === "taken_late"
        ).length;
        const missed = dayLogs.filter(
          (l: any) => l.status === "missed" || l.status === "skipped"
        ).length;

        // Past days: total = whatever was logged (avoids retroactively
        // inflating history with newly added meds).
        // Today: total = max(scheduled-by-now, logged) so progress stays
        // accurate during the day.
        let total: number;
        if (istKey === todayISTKey) {
          total = Math.max(dosesScheduledByNowToday, taken + missed);
        } else {
          total = taken + missed;
        }
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
