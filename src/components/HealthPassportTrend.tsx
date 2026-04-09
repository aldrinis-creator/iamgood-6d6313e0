import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
} from "recharts";

interface TrendPoint {
  label: string;
  overall: number;
}

type Period = "daily" | "weekly" | "monthly";

interface HealthPassportTrendProps {
  userId: string;
}

const AUTO_COLLAPSE_MS = 5 * 60_000; // 5 minutes

const HealthPassportTrend = ({ userId }: HealthPassportTrendProps) => {
  const [period, setPeriod] = useState<Period>("daily");
  const [data, setData] = useState<TrendPoint[]>([]);
  const [open, setOpen] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const resetCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    if (open) {
      collapseTimerRef.current = setTimeout(() => setOpen(false), AUTO_COLLAPSE_MS);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      resetCollapseTimer();
    } else if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }
    return () => { if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current); };
  }, [open, resetCollapseTimer]);

  useEffect(() => {
    if (!userId || !open) return;

    const fetchTrend = async () => {
      const now = new Date();
      let fromDate: string;

      if (period === "daily") {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        fromDate = d.toISOString().slice(0, 10);
      } else if (period === "weekly") {
        const d = new Date(now);
        d.setDate(d.getDate() - 27);
        fromDate = d.toISOString().slice(0, 10);
      } else {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 5);
        d.setDate(1);
        fromDate = d.toISOString().slice(0, 10);
      }

      const { data: rows } = await supabase
        .from("health_passport_scores")
        .select("score_date, overall")
        .eq("user_id", userId)
        .gte("score_date", fromDate)
        .order("score_date", { ascending: true });

      if (!rows || rows.length === 0) {
        setData([]);
        return;
      }

      if (period === "daily") {
        setData(
          rows.map((r) => ({
            label: new Date(r.score_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }),
            overall: r.overall,
          }))
        );
      } else if (period === "weekly") {
        const weeks: Record<string, number[]> = {};
        rows.forEach((r) => {
          const d = new Date(r.score_date + "T00:00:00");
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const key = weekStart.toISOString().slice(0, 10);
          if (!weeks[key]) weeks[key] = [];
          weeks[key].push(r.overall);
        });
        setData(
          Object.entries(weeks).map(([key, vals]) => ({
            label: new Date(key + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
            overall: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
          }))
        );
      } else {
        const months: Record<string, number[]> = {};
        rows.forEach((r) => {
          const key = r.score_date.slice(0, 7);
          if (!months[key]) months[key] = [];
          months[key].push(r.overall);
        });
        setData(
          Object.entries(months).map(([key, vals]) => ({
            label: new Date(key + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short" }),
            overall: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
          }))
        );
      }
    };

    fetchTrend();
  }, [userId, period, open]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span>Score Trend</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2" onMouseEnter={resetCollapseTimer} onTouchStart={resetCollapseTimer}>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>

        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No trend data yet. Keep logging daily!</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <ReferenceArea y1={70} y2={100} fill="hsl(var(--success))" fillOpacity={0.08} />
                <ReferenceArea y1={40} y2={70} fill="hsl(38 92% 50%)" fillOpacity={0.08} />
                <ReferenceArea y1={0} y2={40} fill="hsl(var(--destructive))" fillOpacity={0.08} />
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  name="Overall Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default HealthPassportTrend;
