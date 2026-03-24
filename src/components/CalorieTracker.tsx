import { useState, useEffect, useMemo } from "react";
import { Flame, Target, TrendingUp, Calendar, Trash2, ChevronLeft, ChevronRight, Pencil, Check, X, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface MealLog {
  id: string;
  meal_type: string;
  meal_name: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fats_g: number;
  total_fiber_g: number;
  log_date: string;
  logged_at: string;
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "🌅 Breakfast",
  lunch: "☀️ Lunch",
  dinner: "🌙 Dinner",
  snack: "🍿 Snack",
  other: "🍽️ Other",
};

const EMPTY_MANUAL = { meal_name: "", meal_type: "other", calories: "", protein: "", carbs: "", fats: "", fiber: "" };

const CalorieTracker = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [chartRange, setChartRange] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allLogs, setAllLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("nutrition_personas")
      .select("daily_calorie_goal")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.daily_calorie_goal) setCalorieGoal(data.daily_calorie_goal);
      });
  }, [user]);

  const refetchDay = () => {
    if (!user) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    supabase
      .from("meal_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("log_date", dateStr)
      .order("logged_at", { ascending: true })
      .then(({ data }) => setLogs((data as MealLog[]) || []));
  };

  useEffect(() => { refetchDay(); }, [user, selectedDate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
    supabase
      .from("meal_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", from)
      .order("log_date", { ascending: true })
      .then(({ data }) => {
        setAllLogs((data as MealLog[]) || []);
        setLoading(false);
      });
  }, [user]);

  const dayLogs = logs;
  const totalCal = dayLogs.reduce((s, l) => s + l.total_calories, 0);
  const totalProtein = dayLogs.reduce((s, l) => s + Number(l.total_protein_g), 0);
  const totalCarbs = dayLogs.reduce((s, l) => s + Number(l.total_carbs_g), 0);
  const totalFats = dayLogs.reduce((s, l) => s + Number(l.total_fats_g), 0);
  const progress = calorieGoal > 0 ? Math.min((totalCal / calorieGoal) * 100, 100) : 0;

  const chartData = useMemo(() => {
    const now = new Date();
    let days: Date[];
    if (chartRange === "week") {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      const we = endOfWeek(now, { weekStartsOn: 1 });
      days = eachDayOfInterval({ start: ws, end: we });
    } else {
      days = eachDayOfInterval({ start: subDays(now, 29), end: now });
    }
    const byDate: Record<string, number> = {};
    allLogs.forEach((l) => {
      byDate[l.log_date] = (byDate[l.log_date] || 0) + l.total_calories;
    });
    return days.map((d) => {
      const ds = format(d, "yyyy-MM-dd");
      return { date: ds, label: chartRange === "week" ? format(d, "EEE") : format(d, "dd"), calories: byDate[ds] || 0 };
    });
  }, [allLogs, chartRange]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("meal_logs").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setAllLogs((prev) => prev.filter((l) => l.id !== id));
    toast.success("Meal removed");
  };

  const handleSaveGoal = async () => {
    const val = parseInt(goalInput);
    if (!val || val < 500 || val > 10000) { toast.error("Enter a value between 500–10,000 kcal"); return; }
    setCalorieGoal(val);
    setEditingGoal(false);
    if (!user) return;
    const { error } = await supabase
      .from("nutrition_personas")
      .upsert({ user_id: user.id, daily_calorie_goal: val, updated_at: new Date().toISOString() } as any, { onConflict: "user_id" });
    if (error) toast.error("Failed to save goal");
    else toast.success("Calorie goal updated");
  };

  const handleManualSave = async () => {
    const name = manual.meal_name.trim();
    if (!name) { toast.error("Enter a meal name"); return; }
    if (name.length > 200) { toast.error("Meal name too long (max 200 chars)"); return; }
    const cal = parseInt(manual.calories) || 0;
    if (cal < 0 || cal > 50000) { toast.error("Calories must be 0–50,000"); return; }
    const protein = parseFloat(manual.protein) || 0;
    const carbs = parseFloat(manual.carbs) || 0;
    const fats = parseFloat(manual.fats) || 0;
    const fiber = parseFloat(manual.fiber) || 0;
    if ([protein, carbs, fats, fiber].some(v => v < 0 || v > 5000)) { toast.error("Macro values must be 0–5,000g"); return; }
    if (!user) return;
    setSaving(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { data, error } = await supabase.from("meal_logs").insert({
      user_id: user.id,
      meal_type: manual.meal_type,
      meal_name: name,
      items: [] as any,
      total_calories: cal,
      total_protein_g: protein,
      total_carbs_g: carbs,
      total_fats_g: fats,
      total_fiber_g: fiber,
      log_date: dateStr,
    }).select().single();
    setSaving(false);
    if (error) { toast.error("Failed to save meal"); return; }
    const newLog = data as MealLog;
    setLogs((prev) => [...prev, newLog]);
    setAllLogs((prev) => [...prev, newLog]);
    setManual(EMPTY_MANUAL);
    setShowManual(false);
    toast.success("Meal logged!");
  };

  const navigateDate = (dir: number) => setSelectedDate((prev) => addDays(prev, dir));
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      {/* Daily Goal Progress */}
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm">Daily Calorie Goal</h3>
            </div>
            {editingGoal ? (
              <div className="flex items-center gap-1">
                <Input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="h-7 w-20 text-xs" min={500} max={10000} autoFocus onKeyDown={(e) => e.key === "Enter" && handleSaveGoal()} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveGoal}><Check className="w-3.5 h-3.5 text-primary" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingGoal(false)}><X className="w-3.5 h-3.5 text-muted-foreground" /></Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => { setGoalInput(String(calorieGoal)); setEditingGoal(true); }}>
                {calorieGoal} kcal <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{totalCal} kcal consumed</span>
            <span>{Math.max(calorieGoal - totalCal, 0)} kcal remaining</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="text-center p-2 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Protein</p>
              <p className="text-sm font-bold text-primary">{Math.round(totalProtein)}g</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Carbs</p>
              <p className="text-sm font-bold text-primary">{Math.round(totalCarbs)}g</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Fats</p>
              <p className="text-sm font-bold text-primary">{Math.round(totalFats)}g</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Navigator */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium">
          {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
        </span>
        <Button variant="ghost" size="icon" onClick={() => navigateDate(1)} disabled={isToday}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Add Meal Button */}
      <Button variant="outline" className="w-full gap-2 border-dashed border-primary/30 text-primary" onClick={() => setShowManual(!showManual)}>
        <Plus className="w-4 h-4" />
        {showManual ? "Cancel" : "Log Meal Manually"}
      </Button>

      {/* Manual Meal Entry Form */}
      {showManual && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Meal Name *</Label>
              <Input placeholder="e.g. Rice and dal" value={manual.meal_name} onChange={(e) => setManual(p => ({ ...p, meal_name: e.target.value }))} maxLength={200} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meal Type</Label>
              <Select value={manual.meal_type} onValueChange={(v) => setManual(p => ({ ...p, meal_type: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MEAL_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Calories (kcal)</Label>
                <Input type="number" placeholder="0" value={manual.calories} onChange={(e) => setManual(p => ({ ...p, calories: e.target.value }))} min={0} max={50000} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Protein (g)</Label>
                <Input type="number" placeholder="0" value={manual.protein} onChange={(e) => setManual(p => ({ ...p, protein: e.target.value }))} min={0} max={5000} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carbs (g)</Label>
                <Input type="number" placeholder="0" value={manual.carbs} onChange={(e) => setManual(p => ({ ...p, carbs: e.target.value }))} min={0} max={5000} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fats (g)</Label>
                <Input type="number" placeholder="0" value={manual.fats} onChange={(e) => setManual(p => ({ ...p, fats: e.target.value }))} min={0} max={5000} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Fiber (g)</Label>
                <Input type="number" placeholder="0" value={manual.fiber} onChange={(e) => setManual(p => ({ ...p, fiber: e.target.value }))} min={0} max={5000} className="h-9 text-sm" />
              </div>
            </div>
            <Button className="w-full" onClick={handleManualSave} disabled={saving}>
              {saving ? "Saving..." : "Save Meal"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Meal Log List */}
      <div className="space-y-2">
        {dayLogs.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-4">No meals logged {isToday ? "today" : "this day"}.</p>
        ) : (
          dayLogs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{MEAL_TYPE_LABELS[log.meal_type] || log.meal_type}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(log.logged_at), "h:mm a")}</span>
                  </div>
                  <p className="text-sm font-medium mt-0.5">{log.meal_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.total_calories} kcal · P {Math.round(Number(log.total_protein_g))}g · C {Math.round(Number(log.total_carbs_g))}g · F {Math.round(Number(log.total_fats_g))}g
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(log.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Separator />

      {/* Chart */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold">Calorie Trend</h3>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={chartRange === "week" ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setChartRange("week")}>Week</Button>
            <Button size="sm" variant={chartRange === "month" ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setChartRange("month")}>Month</Button>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(val: number) => [`${val} kcal`, "Calories"]} />
              <ReferenceLine y={calorieGoal} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: "Goal", fontSize: 10, fill: "hsl(var(--destructive))" }} />
              <Bar dataKey="calories" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CalorieTracker;
