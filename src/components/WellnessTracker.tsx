import { useState, useEffect } from "react";
import {
  HeartPulse, Smile, Frown, Meh, Laugh, Angry,
  Moon, Zap, Brain, Save, Wind, Flower2, Music, Eye,
  TrendingUp, TrendingDown, Minus, Volume2, VolumeX, Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { startMindfulnessAudio, stopMindfulnessAudio } from "@/lib/mindfulnessAudio";
const MOODS = [
  { key: "great", label: "Great", icon: Laugh, color: "text-success" },
  { key: "good", label: "Good", icon: Smile, color: "text-success" },
  { key: "okay", label: "Okay", icon: Meh, color: "text-primary" },
  { key: "low", label: "Low", icon: Frown, color: "text-sos" },
  { key: "bad", label: "Bad", icon: Angry, color: "text-sos" },
] as const;

const MOOD_SCORE: Record<string, number> = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };

const MINDFULNESS_EXERCISES = [
  { icon: Wind, label: "Deep Breathing", desc: "4-7-8 breathing technique • 5 min", duration: 5 },
  { icon: Flower2, label: "Body Scan", desc: "Progressive relaxation • 10 min", duration: 10 },
  { icon: Music, label: "Sound Meditation", desc: "Focus on ambient sounds • 8 min", duration: 8 },
  { icon: Eye, label: "Visualization", desc: "Safe place imagery • 7 min", duration: 7 },
];

interface WellnessLog {
  log_date: string;
  mood: string;
  mood_score: number;
  sleep_quality: number;
  sleep_hours: number;
  energy_level: number;
  stress_level: number;
  mindfulness_minutes: number;
  notes: string | null;
}

const WellnessTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<WellnessLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeExercise, setActiveExercise] = useState<number | null>(null);
  const [exerciseTimer, setExerciseTimer] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);

  const [form, setForm] = useState({
    mood: "okay",
    sleep_quality: 3,
    sleep_hours: 7,
    energy_level: 3,
    stress_level: 3,
    mindfulness_minutes: 0,
    notes: "",
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const startDate = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const { data } = await supabase
      .from("wellness_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", startDate)
      .order("log_date", { ascending: true });

    if (data) {
      setHistory(data as WellnessLog[]);
      const today = format(new Date(), "yyyy-MM-dd");
      const todayEntry = data.find((d: any) => d.log_date === today);
      if (todayEntry) {
        setForm({
          mood: todayEntry.mood,
          sleep_quality: todayEntry.sleep_quality ?? 3,
          sleep_hours: todayEntry.sleep_hours ?? 7,
          energy_level: todayEntry.energy_level ?? 3,
          stress_level: todayEntry.stress_level ?? 3,
          mindfulness_minutes: todayEntry.mindfulness_minutes ?? 0,
          notes: todayEntry.notes || "",
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  // Exercise timer
  useEffect(() => {
    if (activeExercise === null) return;
    const target = MINDFULNESS_EXERCISES[activeExercise].duration * 60;
    if (exerciseTimer >= target) {
      setForm(f => ({ ...f, mindfulness_minutes: f.mindfulness_minutes + MINDFULNESS_EXERCISES[activeExercise!].duration }));
      toast({ title: "Exercise Complete! 🧘", description: `Great job completing ${MINDFULNESS_EXERCISES[activeExercise!].label}` });
      stopMindfulnessAudio();
      setActiveExercise(null);
      setExerciseTimer(0);
      return;
    }
    const interval = setInterval(() => setExerciseTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeExercise, exerciseTimer]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { stopMindfulnessAudio(); };
  }, []);

  const startExercise = (index: number) => {
    setActiveExercise(index);
    setExerciseTimer(0);
    if (!audioMuted) startMindfulnessAudio(index);
  };

  const stopExercise = () => {
    stopMindfulnessAudio();
    setActiveExercise(null);
    setExerciseTimer(0);
  };

  const toggleAudio = () => {
    const newMuted = !audioMuted;
    setAudioMuted(newMuted);
    if (activeExercise !== null) {
      if (newMuted) stopMindfulnessAudio();
      else startMindfulnessAudio(activeExercise);
    }
  };

  const saveWellnessScore = async () => {
    if (!user || form.mindfulness_minutes <= 0) return;
    setSaving(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const { error } = await supabase
      .from("wellness_logs")
      .upsert({
        user_id: user.id,
        log_date: today,
        mood: form.mood,
        mood_score: MOOD_SCORE[form.mood] || 3,
        sleep_quality: form.sleep_quality,
        sleep_hours: form.sleep_hours,
        energy_level: form.energy_level,
        stress_level: form.stress_level,
        mindfulness_minutes: form.mindfulness_minutes,
        notes: form.notes || null,
      }, { onConflict: "user_id,log_date" });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Wellness Score Updated! 🏆", description: `${form.mindfulness_minutes} min added to your Health Passport.` });
      fetchData();
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const { error } = await supabase
      .from("wellness_logs")
      .upsert({
        user_id: user.id,
        log_date: today,
        mood: form.mood,
        mood_score: MOOD_SCORE[form.mood] || 3,
        sleep_quality: form.sleep_quality,
        sleep_hours: form.sleep_hours,
        energy_level: form.energy_level,
        stress_level: form.stress_level,
        mindfulness_minutes: form.mindfulness_minutes,
        notes: form.notes || null,
      }, { onConflict: "user_id,log_date" });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Today's wellness logged!" });
      setShowForm(false);
      fetchData();
    }
    setSaving(false);
  };

  const qualityLabel = (v: number) => ["", "Poor", "Fair", "Good", "Great", "Excellent"][v] || "";
  const getTrend = (key: keyof WellnessLog) => {
    if (history.length < 2) return null;
    const recent = Number(history[history.length - 1][key]) || 0;
    const prev = Number(history[history.length - 2][key]) || 0;
    if (recent > prev) return "up";
    if (recent < prev) return "down";
    return "flat";
  };

  const TrendIcon = ({ trend }: { trend: string | null }) => {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-success" />;
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-sos" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const todayMood = MOODS.find(m => m.key === form.mood) || MOODS[2];
  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading) return <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-primary" />
          Wellness Tracker
        </h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          {showForm ? "Cancel" : "Log Today"}
        </Button>
      </div>

      {/* Today's Snapshot */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <todayMood.icon className={`w-8 h-8 ${todayMood.color}`} />
            <div>
              <p className="text-[10px] text-muted-foreground">Mood</p>
              <p className="text-sm font-semibold flex items-center gap-1">
                {todayMood.label} <TrendIcon trend={getTrend("mood_score")} />
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Moon className="w-8 h-8 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Sleep</p>
              <p className="text-sm font-semibold flex items-center gap-1">
                {form.sleep_hours}h • {qualityLabel(form.sleep_quality)}
                <TrendIcon trend={getTrend("sleep_quality")} />
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Zap className="w-8 h-8 text-success" />
            <div>
              <p className="text-[10px] text-muted-foreground">Energy</p>
              <p className="text-sm font-semibold flex items-center gap-1">
                {qualityLabel(form.energy_level)} <TrendIcon trend={getTrend("energy_level")} />
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Brain className="w-8 h-8 text-sos" />
            <div>
              <p className="text-[10px] text-muted-foreground">Stress</p>
              <p className="text-sm font-semibold flex items-center gap-1">
                {qualityLabel(form.stress_level)} <TrendIcon trend={getTrend("stress_level")} />
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Log Form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold">How are you feeling today?</h3>

            {/* Mood selector */}
            <div>
              <Label className="text-xs">Mood</Label>
              <div className="flex gap-2 mt-1">
                {MOODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setForm(f => ({ ...f, mood: m.key }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all flex-1 ${
                      form.mood === m.key ? "border-primary bg-primary/5 shadow-sm" : "border-border"
                    }`}
                  >
                    <m.icon className={`w-6 h-6 ${m.color}`} />
                    <span className="text-[10px]">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sleep */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sleep Hours: {form.sleep_hours}h</Label>
                <Slider
                  min={0} max={14} step={0.5}
                  value={[form.sleep_hours]}
                  onValueChange={([v]) => setForm(f => ({ ...f, sleep_hours: v }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-xs">Sleep Quality: {qualityLabel(form.sleep_quality)}</Label>
                <Slider
                  min={1} max={5} step={1}
                  value={[form.sleep_quality]}
                  onValueChange={([v]) => setForm(f => ({ ...f, sleep_quality: v }))}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Energy & Stress */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Energy: {qualityLabel(form.energy_level)}</Label>
                <Slider
                  min={1} max={5} step={1}
                  value={[form.energy_level]}
                  onValueChange={([v]) => setForm(f => ({ ...f, energy_level: v }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-xs">Stress: {qualityLabel(form.stress_level)}</Label>
                <Slider
                  min={1} max={5} step={1}
                  value={[form.stress_level]}
                  onValueChange={([v]) => setForm(f => ({ ...f, stress_level: v }))}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="How's your day going?"
                className="text-sm mt-1"
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save Today's Wellness"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 7-Day Mood Timeline */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">7-Day Mood Timeline</h3>
          <div className="flex justify-between">
            {Array.from({ length: 7 }, (_, i) => {
              const date = subDays(new Date(), 6 - i);
              const dateStr = format(date, "yyyy-MM-dd");
              const entry = history.find(h => h.log_date === dateStr);
              const MoodIcon = entry ? (MOODS.find(m => m.key === entry.mood)?.icon || Meh) : Meh;
              const moodColor = entry ? (MOODS.find(m => m.key === entry.mood)?.color || "text-muted-foreground") : "text-muted-foreground/30";
              return (
                <div key={dateStr} className="flex flex-col items-center gap-1">
                  <MoodIcon className={`w-6 h-6 ${moodColor}`} />
                  <span className="text-[9px] text-muted-foreground">{format(date, "EEE")}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sleep Insights */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Moon className="w-4 h-4 text-primary" /> Sleep Insights
          </h3>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Log a few days to see sleep insights.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between">
                {history.slice(-7).map(h => {
                  const pct = Math.min((h.sleep_hours / 9) * 100, 100);
                  return (
                    <div key={h.log_date} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-5 bg-secondary rounded-full overflow-hidden" style={{ height: 48 }}>
                        <div
                          className="w-full bg-primary rounded-full transition-all"
                          style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{h.sleep_hours}h</span>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const avg = history.reduce((s, h) => s + h.sleep_hours, 0) / history.length;
                const avgQuality = history.reduce((s, h) => s + (h.sleep_quality ?? 3), 0) / history.length;
                return (
                  <div className="flex gap-3 text-xs">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-full">
                      Avg: {avg.toFixed(1)}h
                    </span>
                    <span className="bg-success/10 text-success px-2 py-1 rounded-full">
                      Quality: {qualityLabel(Math.round(avgQuality))}
                    </span>
                    <span className={`px-2 py-1 rounded-full ${avg >= 7 ? "bg-success/10 text-success" : "bg-sos/10 text-sos"}`}>
                      {avg >= 7 ? "On track ✓" : "Below 7h target"}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mindfulness Exercises */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Mindfulness Exercises
          </h3>

          {/* Large timer display when exercise is active */}
          {activeExercise !== null && (() => {
            const ex = MINDFULNESS_EXERCISES[activeExercise];
            const targetSec = ex.duration * 60;
            const pct = Math.min((exerciseTimer / targetSec) * 100, 100);
            const radius = 54;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (pct / 100) * circumference;
            return (
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r={radius} fill="none"
                      stroke="hsl(var(--primary))" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="flex flex-col items-center z-10">
                    <ex.icon className="w-6 h-6 text-primary mb-1" />
                    <span className="text-4xl font-bold tabular-nums text-foreground">
                      {formatTimer(exerciseTimer)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{ex.duration}:00</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground">{ex.label}</p>
                <Button
                  size="sm" variant="outline"
                  onClick={() => { setActiveExercise(null); setExerciseTimer(0); }}
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  Stop
                </Button>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-2">
            {MINDFULNESS_EXERCISES.map((ex, i) => {
              const isActive = activeExercise === i;
              const isDimmed = activeExercise !== null && !isActive;
              return (
                <button
                  key={ex.label}
                  disabled={isDimmed}
                  onClick={() => {
                    if (isActive) {
                      setActiveExercise(null);
                      setExerciseTimer(0);
                    } else {
                      setActiveExercise(i);
                      setExerciseTimer(0);
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30"
                  } ${isDimmed ? "opacity-40 pointer-events-none" : ""}`}
                >
                  <ex.icon className={`w-5 h-5 mb-1 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-xs font-medium">{ex.label}</p>
                  <p className="text-[10px] text-muted-foreground">{ex.desc}</p>
                </button>
              );
            })}
          </div>
          {form.mindfulness_minutes > 0 && (
            <p className="text-xs text-success text-center">
              🧘 {form.mindfulness_minutes} min of mindfulness today
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WellnessTracker;
