import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Save, Check, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReportShareButtons from "@/components/ReportShareButtons";

type Point = { date: string; value: number };
interface MetricDef {
  key: string; label: string; unit: string;
  low?: number; high?: number; // normal range
  lowerIsBetter?: boolean;
}

const METRICS: MetricDef[] = [
  { key: "heart_rate", label: "Heart Rate", unit: "bpm", low: 60, high: 100 },
  { key: "spo2", label: "SpO2", unit: "%", low: 95 },
  { key: "bp_systolic", label: "BP Systolic", unit: "mmHg", low: 90, high: 130 },
  { key: "bp_diastolic", label: "BP Diastolic", unit: "mmHg", low: 60, high: 85 },
  { key: "glucose_mg_dl", label: "Blood Sugar", unit: "mg/dL", low: 70, high: 140 },
  { key: "temperature_c", label: "Temperature", unit: "°C", low: 36.1, high: 37.5 },
  { key: "steps", label: "Steps", unit: "", low: 3000 },
  { key: "sleep_hours", label: "Sleep", unit: "hrs", low: 6, high: 9 },
  { key: "stress_score", label: "Stress Score", unit: "", high: 60, lowerIsBetter: true },
];

const round = (n: number) => Math.round(n * 10) / 10;
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

interface Props { userId: string; ownerName?: string; allowSave?: boolean }

const VitalsTrendReport = ({ userId, ownerName, allowSave = true }: Props) => {
  const [series, setSeries] = useState<Record<string, Point[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000);
    const sinceDate = since.toISOString().slice(0, 10);
    Promise.all([
      supabase.from("activity_logs")
        .select("log_date,heart_rate,spo2,bp_systolic,bp_diastolic,glucose_mg_dl,temperature_c,steps,sleep_hours")
        .eq("user_id", userId).gte("log_date", sinceDate).order("log_date"),
      supabase.from("face_scans").select("scanned_at,heart_rate,stress_score")
        .eq("user_id", userId).gte("scanned_at", since.toISOString()).order("scanned_at"),
    ]).then(([a, f]) => {
      const out: Record<string, Point[]> = {};
      const push = (k: string, date: string, v: any) => {
        const n = Number(v);
        if (v === null || v === undefined || !isFinite(n) || n <= 0) return;
        (out[k] ||= []).push({ date, value: n });
      };
      for (const r of (a.data || []) as any[]) {
        for (const m of METRICS) if (m.key !== "stress_score") push(m.key, r.log_date, r[m.key]);
      }
      for (const s of (f.data || []) as any[]) {
        const d = String(s.scanned_at).slice(0, 10);
        push("stress_score", d, s.stress_score);
        if (!(a.data || []).some((r: any) => r.log_date === d && r.heart_rate)) push("heart_rate", d, s.heart_rate);
      }
      for (const k of Object.keys(out)) out[k].sort((x, y) => x.date.localeCompare(y.date));
      setSeries(out);
      setLoading(false);
    });
  }, [userId]);

  const rows = useMemo(() => METRICS.filter(m => series[m.key]?.length).map(m => {
    const pts = series[m.key];
    const vals = pts.map(p => p.value);
    const latest = vals[vals.length - 1];
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const cur = pts.filter(p => p.date >= weekAgo).map(p => p.value);
    const prev = pts.filter(p => p.date < weekAgo).map(p => p.value);
    let trend: "up" | "down" | "steady" = "steady";
    if (cur.length && prev.length) {
      const c = cur.reduce((s, v) => s + v, 0) / cur.length;
      const p = prev.reduce((s, v) => s + v, 0) / prev.length;
      const diff = (c - p) / (p || 1);
      if (diff > 0.05) trend = "up"; else if (diff < -0.05) trend = "down";
    }
    const out = (m.low !== undefined && latest < m.low) || (m.high !== undefined && latest > m.high);
    return { m, pts, latest, avg, min: Math.min(...vals), max: Math.max(...vals), trend, out };
  }), [series]);

  const markdown = useMemo(() => {
    const head = `**Period:** last 30 days${ownerName ? ` · **For:** ${ownerName}` : ""}\n\n`;
    const body = rows.map(r =>
      `**${r.m.label}** — Latest ${round(r.latest)} ${r.m.unit} · Avg ${round(r.avg)} · Low ${round(r.min)} · High ${round(r.max)} · Trend: ${r.trend === "up" ? "going up" : r.trend === "down" ? "going down" : "steady"}${r.out ? " · ⚠️ outside normal range" : ""}`
    ).join("\n\n");
    return head + (body || "No vitals recorded in the last 30 days.") + "\n\n_Readings are device/PPG estimates — not medical grade._";
  }, [rows, ownerName]);

  const saveToVault = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("medical_records").insert({
        user_id: userId,
        title: `Your Health Vitals — ${new Date().toLocaleDateString("en-IN")}`,
        record_type: "Vitals Report",
        description: markdown.substring(0, 50000),
        record_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      setSaved(true);
      toast.success("Saved to your Vault under Vitals Report");
    } catch (e: any) {
      toast.error(`Failed to save: ${e?.message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-6 text-center text-muted-foreground">Loading your vitals…</div>;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Your Health Vitals</h3>
          <p className="text-sm text-muted-foreground">Trends from the last 30 days. Data older than a month is removed on the 7th of each month.</p>
        </div>

        {rows.length === 0 && <p className="text-base text-muted-foreground">No vitals recorded in the last 30 days.</p>}

        {rows.map(r => {
          const TrendIcon = r.trend === "up" ? TrendingUp : r.trend === "down" ? TrendingDown : Minus;
          return (
            <div key={r.m.key} className={`rounded-lg border p-3 space-y-2 ${r.out ? "border-destructive/40 bg-destructive/5" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{r.m.label}</p>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <TrendIcon className="w-4 h-4" />
                  {r.trend === "up" ? "Going up" : r.trend === "down" ? "Going down" : "Steady"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-sm">
                {[["Latest", r.latest], ["Average", r.avg], ["Lowest", r.min], ["Highest", r.max]].map(([l, v]) => (
                  <div key={l as string} className="rounded bg-muted/50 p-1">
                    <p className={`font-bold ${l === "Latest" && r.out ? "text-destructive" : ""}`}>{round(v as number)}</p>
                    <p className="text-xs text-muted-foreground">{l as string}</p>
                  </div>
                ))}
              </div>
              {r.pts.length > 1 && (
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart data={r.pts.map(p => ({ date: shortDate(p.date), v: p.value }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} width={32} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Line type="monotone" dataKey="v" name={r.m.label} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {r.out && <p className="text-sm text-destructive">Latest reading is outside the usual range{r.m.unit ? ` (${r.m.unit})` : ""}.</p>}
            </div>
          );
        })}

        <ReportShareButtons title="Your Health Vitals" subtitle="30-day vitals trend" content={markdown} category="Vitals" />
        {allowSave && (
          <Button variant={saved ? "secondary" : "outline"} className="w-full gap-1.5" onClick={saveToVault} disabled={saving || saved}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : saved ? "Saved to Secure Vault" : "Save to Secure Vault"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default VitalsTrendReport;
