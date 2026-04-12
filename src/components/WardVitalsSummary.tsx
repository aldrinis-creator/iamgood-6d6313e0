import { useState, useEffect } from "react";
import { Heart, Activity, Brain, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import VisualHealthReport, { tryParseVisualReport } from "@/components/health-tools/VisualHealthReport";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { formatISTDateShort } from "@/lib/istTime";

interface Props {
  wardUserId: string;
  wardName: string;
}

const WardVitalsSummary = ({ wardUserId, wardName }: Props) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [wellness, setWellness] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    Promise.all([
      supabase.from("activity_logs").select("log_date,steps,heart_rate,calories,spo2,sleep_hours").eq("user_id", wardUserId).gte("log_date", sevenDaysAgo).order("log_date"),
      supabase.from("face_scans").select("heart_rate,stress_score,stress_level,scanned_at,confidence").eq("user_id", wardUserId).order("scanned_at", { ascending: false }).limit(10),
      supabase.from("wellness_logs").select("log_date,mood,mood_score,stress_level,energy_level,sleep_hours").eq("user_id", wardUserId).gte("log_date", sevenDaysAgo).order("log_date"),
    ]).then(([a, f, w]) => {
      setActivities(a.data || []);
      setScans(f.data || []);
      setWellness(w.data || []);
      setLoading(false);
    });
  }, [wardUserId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayActivity = activities.find(a => a.log_date === today);
  const latestScan = scans[0];
  const todayWellness = wellness.find(w => w.log_date === today);

  const chartData = activities.map(a => ({
    date: formatISTDateShort(a.log_date),
    hr: a.heart_rate || 0,
    spo2: a.spo2 || 0,
  }));

  const getAiInsights = async () => {
    setLoadingAi(true);
    setAiInsights(null);
    try {
      const payload = JSON.stringify({
        activities: activities.slice(-7),
        wellness: wellness.slice(-7),
        faceScans: scans.slice(0, 5).map(s => ({ heart_rate: s.heart_rate, stress_score: s.stress_score, stress_level: s.stress_level, confidence: s.confidence })),
      });
      const { data, error } = await supabase.functions.invoke("health-tools", { body: { type: "vitals_insights", payload } });
      if (error) throw error;
      setAiInsights(data.response);
    } catch (e: any) {
      toast.error(e.message || "Failed to get AI insights");
    } finally {
      setLoadingAi(false);
    }
  };

  if (loading) return null;

  const metrics = [
    { label: "Heart Rate", value: latestScan?.heart_rate ?? "--", unit: "bpm", icon: <Heart className="w-4 h-4" />, color: "text-sos" },
    { label: "SpO2", value: todayActivity?.spo2 ?? "--", unit: "%", icon: <Activity className="w-4 h-4" />, color: "text-primary" },
    { label: "Stress", value: latestScan?.stress_level ?? "--", unit: "", icon: <Brain className="w-4 h-4" />, color: "text-warning" },
    { label: "Steps", value: todayActivity?.steps ?? 0, unit: "", icon: <Activity className="w-4 h-4" />, color: "text-success" },
    { label: "Calories", value: todayActivity?.calories ?? 0, unit: "kcal", icon: <Activity className="w-4 h-4" />, color: "text-primary" },
    { label: "Sleep", value: todayWellness?.sleep_hours ?? todayActivity?.sleep_hours ?? "--", unit: "hrs", icon: <Activity className="w-4 h-4" />, color: "text-success" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Heart className="w-5 h-5 text-sos" />
          {wardName}'s Vitals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2 text-[10px] text-muted-foreground">
          <AlertTriangle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
          <span>PPG-estimated data — not medical grade.</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="text-center p-2 rounded-lg bg-muted/50">
              <div className={`mx-auto mb-1 ${m.color}`}>{m.icon}</div>
              <p className="text-sm font-bold">{m.value} <span className="text-[10px] font-normal text-muted-foreground">{m.unit}</span></p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        {chartData.length > 1 && (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="hr" name="HR" stroke="hsl(var(--sos))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="spo2" name="SpO2" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}

        <Button onClick={getAiInsights} disabled={loadingAi} size="sm" className="w-full gap-2">
          <Brain className="w-4 h-4" /> {loadingAi ? "Analyzing…" : "Get AI Insights"}
        </Button>

        {aiInsights && (() => {
            const visual = tryParseVisualReport(aiInsights);
            if (visual) return <VisualHealthReport report={visual} />;
            return (
              <div className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-3">
                <ReactMarkdown>{aiInsights}</ReactMarkdown>
              </div>
            );
          })()}
      </CardContent>
    </Card>
  );
};

export default WardVitalsSummary;
