import { useState, useEffect } from "react";
import { Footprints, Dumbbell, Moon, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

const EXERCISE_TYPES = ["Walking", "Running", "Yoga", "Cycling", "Swimming", "Gym", "Other"];

interface ActivityLog {
  id: string;
  log_date: string;
  steps: number;
  exercise_minutes: number;
  exercise_type: string | null;
  sleep_hours: number;
  notes: string | null;
}

const ActivityTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [steps, setSteps] = useState(0);
  const [exerciseMinutes, setExerciseMinutes] = useState(0);
  const [exerciseType, setExerciseType] = useState("");
  const [sleepHours, setSleepHours] = useState(0);
  const [notes, setNotes] = useState("");
  const [weekData, setWeekData] = useState<ActivityLog[]>([]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const sevenDaysAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");

    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", sevenDaysAgo)
      .order("log_date", { ascending: true });

    if (data) {
      setWeekData(data as ActivityLog[]);
      const todayEntry = data.find((d: any) => d.log_date === today);
      if (todayEntry) {
        setSteps(todayEntry.steps);
        setExerciseMinutes(todayEntry.exercise_minutes);
        setExerciseType(todayEntry.exercise_type || "");
        setSleepHours(todayEntry.sleep_hours);
        setNotes(todayEntry.notes || "");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

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
          steps,
          exercise_minutes: exerciseMinutes,
          exercise_type: exerciseType || null,
          sleep_hours: sleepHours,
          notes: notes || null,
        },
        { onConflict: "user_id,log_date" }
      );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Today's activity logged!" });
      fetchData();
    }
    setSaving(false);
  };

  // Build chart data for 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const entry = weekData.find((d) => d.log_date === date);
    return {
      day: format(subDays(new Date(), 6 - i), "EEE"),
      steps: entry?.steps || 0,
      exercise: entry?.exercise_minutes || 0,
    };
  });

  const chartConfig = {
    steps: { label: "Steps", color: "hsl(var(--primary))" },
    exercise: { label: "Exercise (min)", color: "hsl(var(--success))" },
  };

  if (loading) {
    return <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Activity Tracker</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Footprints, label: "Steps", value: steps.toLocaleString(), color: "text-primary" },
          { icon: Dumbbell, label: "Exercise", value: `${exerciseMinutes} min`, color: "text-success" },
          { icon: Moon, label: "Sleep", value: `${sleepHours} hrs`, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex flex-col items-center gap-1">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-sm font-semibold">{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Log Form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Log Today's Activity</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Steps</Label>
              <Input type="number" min={0} value={steps} onChange={(e) => setSteps(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Sleep (hours)</Label>
              <Input type="number" min={0} max={24} step={0.5} value={sleepHours} onChange={(e) => setSleepHours(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Exercise Type</Label>
              <Select value={exerciseType} onValueChange={setExerciseType}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EXERCISE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Minutes</Label>
              <Input type="number" min={0} value={exerciseMinutes} onChange={(e) => setExerciseMinutes(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : "Save Today's Log"}
          </Button>
        </CardContent>
      </Card>

      {/* 7-Day Chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">7-Day Overview</h3>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="steps" fill="var(--color-steps)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="exercise" fill="var(--color-exercise)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityTracker;
