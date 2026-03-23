import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Activity, Upload, Brain, Play, Square, FileText, Save, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ───────── types ───────── */
interface VitalMetric { label: string; value: string | number; unit: string; icon: React.ReactNode; color: string }
interface ActivityLog { log_date: string; steps: number; heart_rate: number; calories: number; spo2: number; sleep_hours: number; exercise_minutes: number }
interface WellnessLog { log_date: string; mood: string; mood_score: number; stress_level: number; energy_level: number; sleep_hours: number }
interface FaceScanRow { heart_rate: number; stress_score: number; stress_level: string; scanned_at: string; confidence: string }

/* ══════════════════════════════════════════════
   1. DASHBOARD TAB
   ══════════════════════════════════════════════ */
const DashboardTab = () => {
  const { session } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [wellness, setWellness] = useState<WellnessLog[]>([]);
  const [scans, setScans] = useState<FaceScanRow[]>([]);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    Promise.all([
      supabase.from("activity_logs").select("log_date,steps,heart_rate,calories,spo2,sleep_hours,exercise_minutes").eq("user_id", uid).gte("log_date", sevenDaysAgo).order("log_date"),
      supabase.from("wellness_logs").select("log_date,mood,mood_score,stress_level,energy_level,sleep_hours").eq("user_id", uid).gte("log_date", sevenDaysAgo).order("log_date"),
      supabase.from("face_scans").select("heart_rate,stress_score,stress_level,scanned_at,confidence").eq("user_id", uid).order("scanned_at", { ascending: false }).limit(10),
    ]).then(([a, w, f]) => {
      setActivities((a.data as ActivityLog[]) || []);
      setWellness((w.data as WellnessLog[]) || []);
      setScans((f.data as FaceScanRow[]) || []);
      setLoading(false);
    });
  }, [session?.user?.id]);

  const today = activities.find(a => a.log_date === new Date().toISOString().slice(0, 10));
  const latestScan = scans[0];
  const todayWellness = wellness.find(w => w.log_date === new Date().toISOString().slice(0, 10));

  const metrics: VitalMetric[] = [
    { label: "Heart Rate", value: latestScan?.heart_rate ?? "--", unit: "bpm", icon: <Heart className="w-4 h-4" />, color: "text-sos" },
    { label: "SpO2", value: today?.spo2 ?? "--", unit: "%", icon: <Activity className="w-4 h-4" />, color: "text-primary" },
    { label: "Stress", value: latestScan?.stress_level ?? "--", unit: "", icon: <Brain className="w-4 h-4" />, color: "text-warning" },
    { label: "Steps", value: today?.steps ?? 0, unit: "", icon: <Activity className="w-4 h-4" />, color: "text-success" },
    { label: "Calories", value: today?.calories ?? 0, unit: "kcal", icon: <Activity className="w-4 h-4" />, color: "text-primary" },
    { label: "Sleep", value: todayWellness?.sleep_hours ?? today?.sleep_hours ?? "--", unit: "hrs", icon: <Activity className="w-4 h-4" />, color: "text-success" },
  ];

  const chartData = activities.map(a => ({
    date: new Date(a.log_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
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

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading vitals…</div>;

  return (
    <div className="space-y-4">
      {/* Disclaimer about face scan data */}
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <span>Face scan data (HR, stress) is PPG-estimated and may be inaccurate. It is not a medical measurement. Always verify with certified devices.</span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-2">
        {metrics.map(m => (
          <Card key={m.label} className="p-0">
            <CardContent className="p-3 text-center space-y-1">
              <div className={`mx-auto ${m.color}`}>{m.icon}</div>
              <p className="text-lg font-bold">{m.value} <span className="text-xs font-normal text-muted-foreground">{m.unit}</span></p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm">7-Day Trends</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="hr" name="Heart Rate" stroke="hsl(var(--sos))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="spo2" name="SpO2" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      <Button onClick={getAiInsights} disabled={loadingAi} className="w-full gap-2">
        <Brain className="w-4 h-4" /> {loadingAi ? "Analyzing…" : "Get AI Insights"}
      </Button>
      {aiInsights && (
        <Card>
          <CardContent className="p-4 prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{aiInsights}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   2. ECG WAVEFORM TAB
   ══════════════════════════════════════════════ */
const ECG_BG = "#111111";
const ECG_LINE = "#00ff00";
const BUFFER_SIZE = 300;
const SAMPLE_INTERVAL = 33; // ~30fps sampling

const EcgTab = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [hr, setHr] = useState<number | null>(null);
  const bufferRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopScan = useCallback(() => {
    setScanning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => { stopScan(); }, [stopScan]);

  const startScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      bufferRef.current = [];
      setHr(null);
      setScanning(true);

      // Hidden canvas for sampling
      const offscreen = document.createElement("canvas");
      offscreen.width = 64;
      offscreen.height = 48;
      const offCtx = offscreen.getContext("2d")!;

      // Sample green channel
      intervalRef.current = setInterval(() => {
        if (!videoRef.current) return;
        offCtx.drawImage(videoRef.current, 0, 0, 64, 48);
        const frame = offCtx.getImageData(0, 0, 64, 48).data;
        let gSum = 0;
        for (let i = 1; i < frame.length; i += 4) gSum += frame[i];
        const avg = gSum / (64 * 48);
        bufferRef.current.push(avg);
        if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift();

        // Estimate HR every 90 samples (~3s)
        if (bufferRef.current.length > 90 && bufferRef.current.length % 30 === 0) {
          const samples = bufferRef.current.slice(-90);
          const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
          let crossings = 0;
          for (let i = 1; i < samples.length; i++) {
            if (samples[i - 1] < mean && samples[i] >= mean) crossings++;
          }
          const durationSec = (samples.length * SAMPLE_INTERVAL) / 1000;
          const bpm = Math.round((crossings / durationSec) * 60);
          if (bpm >= 40 && bpm <= 200) setHr(bpm);
        }
      }, SAMPLE_INTERVAL);

      // Render loop
      const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = ECG_BG;
        ctx.fillRect(0, 0, w, h);

        // Draw grid
        ctx.strokeStyle = "#1a3a1a";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

        const buf = bufferRef.current;
        if (buf.length < 2) { rafRef.current = requestAnimationFrame(draw); return; }

        const min = Math.min(...buf);
        const max = Math.max(...buf);
        const range = max - min || 1;
        const step = w / BUFFER_SIZE;

        ctx.beginPath();
        ctx.strokeStyle = ECG_LINE;
        ctx.lineWidth = 2;
        ctx.shadowColor = ECG_LINE;
        ctx.shadowBlur = 4;
        buf.forEach((v, i) => {
          const x = i * step;
          const y = h - ((v - min) / range) * (h * 0.8) - h * 0.1;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        rafRef.current = requestAnimationFrame(draw);
      };
      rafRef.current = requestAnimationFrame(draw);
    } catch {
      toast.error("Camera access denied");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <span>This is a PPG-based estimation, NOT a medical-grade ECG. For accurate readings, use a certified ECG device.</span>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-border bg-[#111]">
        <canvas ref={canvasRef} width={600} height={200} className="w-full h-[200px]" />
        {hr !== null && (
          <div className="absolute top-2 right-3 bg-black/70 text-[#00ff00] px-3 py-1 rounded-full text-sm font-mono">
            ♥ {hr} bpm
          </div>
        )}
      </div>

      {/* Hidden video element */}
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="flex gap-2">
        {!scanning ? (
          <Button onClick={startScan} className="flex-1 gap-2">
            <Play className="w-4 h-4" /> Start ECG View
          </Button>
        ) : (
          <Button onClick={stopScan} variant="destructive" className="flex-1 gap-2">
            <Square className="w-4 h-4" /> Stop
          </Button>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   3. DEVICE REPORTS TAB
   ══════════════════════════════════════════════ */
const DeviceReportsTab = () => {
  const { session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error("Max 4 MB"); return; }
    setFile(f);
    setAnalysis(null);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "document_analysis", payload: { image: dataUrl, category: "ECG / Device Report" } },
      });
      if (error) throw error;
      setAnalysis(data.response);
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const saveToVault = async () => {
    if (!analysis || !session?.user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("medical_records").insert({
        user_id: session.user.id,
        title: `Device Report Analysis - ${new Date().toLocaleDateString("en-IN")}`,
        record_type: "Lab Report",
        description: analysis,
      });
      if (error) throw error;
      toast.success("Saved to Medical Vault");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Upload an ECG report, Holter monitor printout, or any medical device output for AI analysis.</p>
          <input type="file" accept="image/*,application/pdf" onChange={handleFile} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary file:font-medium" />
          {preview && <img src={preview} alt="preview" className="rounded-lg max-h-48 mx-auto" />}
          <Button onClick={analyze} disabled={!file || loading} className="w-full gap-2">
            <FileText className="w-4 h-4" /> {loading ? "Analyzing…" : "Analyze Report"}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
            <Button onClick={saveToVault} disabled={saving} variant="outline" className="w-full gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save to Medical Vault"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
const VitalsMonitor = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Vitals Monitor</h2>
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="dashboard" className="text-xs gap-1"><Heart className="w-3 h-3" /> Dashboard</TabsTrigger>
          <TabsTrigger value="ecg" className="text-xs gap-1"><Activity className="w-3 h-3" /> ECG View</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs gap-1"><Upload className="w-3 h-3" /> Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="ecg"><EcgTab /></TabsContent>
        <TabsContent value="reports"><DeviceReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default VitalsMonitor;
