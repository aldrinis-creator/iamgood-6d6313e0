import { useState, useRef } from "react";
import { UtensilsCrossed, Camera, Dumbbell, Thermometer, Loader2, ArrowLeft, X, Upload, Flame, CheckCircle, AlertTriangle, Lightbulb, Star, Info, Save, BarChart3, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CalorieTracker from "./CalorieTracker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type ActionType = "meal_plan" | "analyze_meal" | "post_workout" | "feeling_unwell";

interface NutritionItem {
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  fiber_g: number;
  health_benefits: string[];
  potential_issues: string[];
  health_rating: number;
  suggestions: string[];
  saturated_fat_g?: number;
  polyunsaturated_fat_g?: number;
  monounsaturated_fat_g?: number;
  trans_fat_g?: number;
  cholesterol_mg?: number;
  sodium_mg?: number;
  potassium_mg?: number;
  sugar_g?: number;
  vitamin_a_iu?: number;
  vitamin_c_mg?: number;
  calcium_mg?: number;
  iron_mg?: number;
}

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

const actionCards = [
  { type: "meal_plan" as ActionType, icon: UtensilsCrossed, title: "Suggest a Meal Plan", desc: "Personalized for this time of day", color: "bg-primary/10 text-primary" },
  { type: "analyze_meal" as ActionType, icon: Camera, title: "Analyze This Meal", desc: "Photo scan for calories & nutrients", color: "bg-success/10 text-success" },
  { type: "post_workout" as ActionType, icon: Dumbbell, title: "Post-Workout Recovery", desc: "Recovery meal based on your activity", color: "bg-primary/10 text-primary" },
  { type: "feeling_unwell" as ActionType, icon: Thermometer, title: "I'm Not Feeling Well", desc: "Gentle meal plan for recovery", color: "bg-sos/10 text-sos" },
];

const MacroBar = ({ protein, carbs, fats }: { protein: number; carbs: number; fats: number }) => {
  const total = protein + carbs + fats;
  if (total === 0) return null;
  const pPct = (protein / total) * 100;
  const cPct = (carbs / total) * 100;
  const fPct = (fats / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full rounded-full overflow-hidden">
        <div className="bg-blue-500 transition-all" style={{ width: `${pPct}%` }} />
        <div className="bg-amber-400 transition-all" style={{ width: `${cPct}%` }} />
        <div className="bg-rose-400 transition-all" style={{ width: `${fPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Protein {protein}g</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Carbs {carbs}g</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Fats {fats}g</span>
      </div>
    </div>
  );
};

const DetailedNutritionList = ({ item }: { item: NutritionItem }) => {
  const rows: { label: string; value: string }[] = [
    { label: "Calories", value: `${item.calories} kcal` },
    { label: "Carbohydrates", value: `${item.carbs_g} g` },
    { label: "Protein", value: `${item.protein_g} g` },
    { label: "Fat", value: `${item.fats_g} g` },
    ...(item.saturated_fat_g ? [{ label: "  Saturated Fat", value: `${item.saturated_fat_g} g` }] : []),
    ...(item.polyunsaturated_fat_g ? [{ label: "  Polyunsaturated Fat", value: `${item.polyunsaturated_fat_g} g` }] : []),
    ...(item.monounsaturated_fat_g ? [{ label: "  Monounsaturated Fat", value: `${item.monounsaturated_fat_g} g` }] : []),
    ...(item.trans_fat_g ? [{ label: "  Trans Fat", value: `${item.trans_fat_g} g` }] : []),
    ...(item.cholesterol_mg ? [{ label: "Cholesterol", value: `${item.cholesterol_mg} mg` }] : []),
    ...(item.sodium_mg ? [{ label: "Sodium", value: `${item.sodium_mg} mg` }] : []),
    ...(item.potassium_mg ? [{ label: "Potassium", value: `${item.potassium_mg} mg` }] : []),
    { label: "Fiber", value: `${item.fiber_g} g` },
    ...(item.sugar_g ? [{ label: "Sugar", value: `${item.sugar_g} g` }] : []),
    ...(item.vitamin_a_iu ? [{ label: "Vitamin A", value: `${item.vitamin_a_iu} IU` }] : []),
    ...(item.vitamin_c_mg ? [{ label: "Vitamin C", value: `${item.vitamin_c_mg} mg` }] : []),
    ...(item.calcium_mg ? [{ label: "Calcium", value: `${item.calcium_mg} mg` }] : []),
    ...(item.iron_mg ? [{ label: "Iron", value: `${item.iron_mg} mg` }] : []),
  ].filter(r => r.value !== "0 g" && r.value !== "0 mg" && r.value !== "0 IU" && r.value !== "0 kcal");

  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-destructive" />
          <h3 className="font-bold text-base">{item.name}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
        {rows.map((row, i) => (
          <div key={i}>
            <div className="flex justify-between items-center py-2">
              <span className={`text-sm ${row.label.startsWith("  ") ? "pl-4 text-muted-foreground" : "font-medium text-foreground"}`}>
                {row.label.trim()}
              </span>
              <span className="text-sm font-semibold text-primary">{row.value}</span>
            </div>
            {i < rows.length - 1 && <Separator className="bg-accent" />}
          </div>
        ))}
        {item.health_rating > 0 && (
          <div className="flex items-center justify-center gap-1 pt-3">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-xs text-muted-foreground">Health Rating: {item.health_rating}/10</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const TotalSummaryCard = ({ items }: { items: NutritionItem[] }) => {
  const sum = (fn: (i: NutritionItem) => number | undefined) =>
    parseFloat(items.reduce((acc, i) => acc + (fn(i) || 0), 0).toFixed(2));
  const avgRating = Math.round(sum(i => i.health_rating) / items.length);

  const rows: { label: string; value: string }[] = [
    { label: "Calories", value: `${sum(i => i.calories)} kcal` },
    { label: "Carbohydrates", value: `${sum(i => i.carbs_g)} g` },
    { label: "Protein", value: `${sum(i => i.protein_g)} g` },
    { label: "Fat", value: `${sum(i => i.fats_g)} g` },
    { label: "Fiber", value: `${sum(i => i.fiber_g)} g` },
    { label: "Cholesterol", value: `${sum(i => i.cholesterol_mg)} mg` },
    { label: "Sodium", value: `${sum(i => i.sodium_mg)} mg` },
    { label: "Potassium", value: `${sum(i => i.potassium_mg)} mg` },
    { label: "Sugar", value: `${sum(i => i.sugar_g)} g` },
  ].filter(r => r.value !== "0 g" && r.value !== "0 mg" && r.value !== "0 kcal");

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-1">
        <h3 className="font-bold text-base text-primary mb-3">🍽️ Meal Total ({items.length} items)</h3>
        {rows.map((row, i) => (
          <div key={i}>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <span className="text-sm font-bold text-primary">{row.value}</span>
            </div>
            {i < rows.length - 1 && <Separator className="bg-primary/20" />}
          </div>
        ))}
        {/* Macro Pie Chart */}
        {(() => {
          const protein = sum(i => i.protein_g);
          const carbs = sum(i => i.carbs_g);
          const fats = sum(i => i.fats_g);
          const total = protein + carbs + fats;
          if (total === 0) return null;
          const data = [
            { name: "Protein", value: protein, color: "hsl(var(--primary))" },
            { name: "Carbs", value: carbs, color: "hsl(45 93% 58%)" },
            { name: "Fats", value: fats, color: "hsl(0 84% 60%)" },
          ];
          return (
            <div className="flex items-center justify-center gap-4 pt-2">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={45} strokeWidth={0}>
                    {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {data.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground">{d.name} {Math.round((d.value / total) * 100)}% ({d.value}g)</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <MacroBar protein={sum(i => i.protein_g)} carbs={sum(i => i.carbs_g)} fats={sum(i => i.fats_g)} />
        {avgRating > 0 && (
          <div className="flex items-center justify-center gap-1 pt-3">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-xs text-muted-foreground">Avg Health Rating: {avgRating}/10</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const NutritionCard = ({ item, hideNutrition = false }: { item: NutritionItem; hideNutrition?: boolean }) => (
  <div className="space-y-3">
    {/* Header card with calories & macros — hidden when table is shown */}
    {!hideNutrition && (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-destructive" />
            <h3 className="font-bold text-base">{item.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>

          {/* Calorie badge */}
          <div className="bg-muted rounded-xl py-4 text-center">
            <span className="text-3xl font-bold text-success tabular-nums">{item.calories}</span>
            <span className="text-sm text-muted-foreground ml-1">kcal</span>
          </div>

          <MacroBar protein={item.protein_g} carbs={item.carbs_g} fats={item.fats_g} />

          {item.fiber_g > 0 && (
            <p className="text-xs text-center text-muted-foreground">Fiber: {item.fiber_g}g</p>
          )}
        </CardContent>
      </Card>
    )}

    {/* Health Benefits */}
    {item.health_benefits?.length > 0 && (
      <Card className="border-success/20">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-success font-semibold text-sm">
            <CheckCircle className="w-4 h-4" />
            Health Benefits
          </div>
          <ul className="space-y-2">
            {item.health_benefits.map((b, i) => (
              <li key={i} className="text-sm text-muted-foreground">• {b}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )}

    {/* Potential Issues */}
    {item.potential_issues?.length > 0 && (
      <Card className="border-destructive/20">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Potential Issues
          </div>
          <ul className="space-y-2">
            {item.potential_issues.map((p, i) => (
              <li key={i} className="text-sm text-muted-foreground">• {p}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )}

    {/* Suggestions */}
    {item.suggestions?.length > 0 && (
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Lightbulb className="w-4 h-4" />
            Suggestions
          </div>
          <ul className="space-y-2">
            {item.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground">• {s}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )}

    {/* Health Rating — only show if nutrition card is visible (otherwise it's in DetailedNutritionList) */}
    {!hideNutrition && item.health_rating > 0 && (
      <div className="flex items-center justify-center gap-1 py-1">
        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        <span className="text-xs text-muted-foreground">Health Rating: {item.health_rating}/10</span>
      </div>
    )}
  </div>
);

const NutritionAdvisor = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [aiResponse, setAiResponse] = useState("");
  const [structuredData, setStructuredData] = useState<NutritionItem[] | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  // Meal photo state
  const [mealImagePreview, setMealImagePreview] = useState<string | null>(null);
  const [mealImageBase64, setMealImageBase64] = useState<string | null>(null);
  const [showMealUpload, setShowMealUpload] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mealType, setMealType] = useState<string>("other");
  const mealFileRef = useRef<HTMLInputElement>(null);

  // Manual meal entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualMeal, setManualMeal] = useState({ meal_name: "", meal_type: "other", calories: "", protein: "", carbs: "", fats: "", fiber: "" });
  const [savingManual, setSavingManual] = useState(false);

  const handleMealImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > MAX_IMAGE_SIZE) { toast.error("Image must be under 4MB"); return; }
    setMealImagePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setMealImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearMealImage = () => {
    setMealImagePreview(null);
    setMealImageBase64(null);
    if (mealFileRef.current) mealFileRef.current.value = "";
  };

  const parseResponse = (raw: string): NutritionItem[] | null => {
    try {
      // Strip markdown code fences if present
      let cleaned = raw.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].calories === "number") {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleAction = async (type: ActionType, image?: string | null) => {
    setActiveAction(type);
    setAiResponse("");
    setStructuredData(null);
    setUsedFallback(false);
    setSaved(false);
    setLoading(true);
    setShowMealUpload(false);
    try {
      let persona: any = null;
      if (user) {
        const { data } = await supabase.from("nutrition_personas").select("*").eq("user_id", user.id).maybeSingle();
        if (data) {
          persona = data;
        } else {
          // Fallback: build partial persona from health_profile
          const { data: hp } = await supabase.from("health_profile").select("*").eq("user_id", user.id).maybeSingle();
          if (hp) {
            persona = {
              blood_group: hp.blood_group,
              allergies: hp.allergies || [],
              medical_conditions: hp.chronic_conditions || [],
              diet_type: "not specified",
              health_goals: [],
              dietary_preferences: [],
              weight_kg: profile?.weight_kg ?? null,
              height_m: profile?.height_m ?? null,
            };
          } else if (profile?.weight_kg || profile?.height_m) {
            persona = {
              weight_kg: profile.weight_kg,
              height_m: profile.height_m,
              diet_type: "not specified",
              health_goals: [],
              dietary_preferences: [],
              allergies: [],
              medical_conditions: [],
            };
          }
          setUsedFallback(true);
        }
      }

      const body: any = { type, persona };
      if (image) body.image = image;
      const { data, error } = await supabase.functions.invoke("nutrition-advisor", { body });
      if (error) throw error;

      const raw = data?.response || "";
      const structured = parseResponse(raw);
      if (structured) {
        setStructuredData(structured);
      } else {
        setAiResponse(raw || "No response received.");
      }
    } catch (e: any) {
      if (e?.message?.includes("429")) toast.error("Rate limited. Try again shortly.");
      else if (e?.message?.includes("402")) toast.error("AI credits exhausted. Please top up.");
      else toast.error("Something went wrong.");
      setActiveAction(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (type: ActionType) => {
    if (type === "analyze_meal") {
      setShowMealUpload(true);
      setActiveAction(type);
      clearMealImage();
    } else {
      handleAction(type);
    }
  };

  const resetView = () => {
    setActiveAction(null);
    setAiResponse("");
    setStructuredData(null);
    setSaved(false);
    clearMealImage();
    setShowMealUpload(false);
    setShowTracker(false);
    setShowManualEntry(false);
    setManualMeal({ meal_name: "", meal_type: "other", calories: "", protein: "", carbs: "", fats: "", fiber: "" });
  };

  const handleManualMealSave = async () => {
    const name = manualMeal.meal_name.trim();
    if (!name) { toast.error("Enter a meal name"); return; }
    if (name.length > 200) { toast.error("Meal name too long (max 200 chars)"); return; }
    const cal = parseInt(manualMeal.calories) || 0;
    if (cal < 0 || cal > 50000) { toast.error("Calories must be 0–50,000"); return; }
    const protein = parseFloat(manualMeal.protein) || 0;
    const carbs = parseFloat(manualMeal.carbs) || 0;
    const fats = parseFloat(manualMeal.fats) || 0;
    const fiber = parseFloat(manualMeal.fiber) || 0;
    if ([protein, carbs, fats, fiber].some(v => v < 0 || v > 5000)) { toast.error("Macro values must be 0–5,000g"); return; }
    if (!user) return;
    setSavingManual(true);
    const { error } = await supabase.from("meal_logs").insert({
      user_id: user.id,
      meal_type: manualMeal.meal_type,
      meal_name: name,
      items: [] as any,
      total_calories: cal,
      total_protein_g: protein,
      total_carbs_g: carbs,
      total_fats_g: fats,
      total_fiber_g: fiber,
    });
    setSavingManual(false);
    if (error) { toast.error("Failed to save meal"); return; }
    setManualMeal({ meal_name: "", meal_type: "other", calories: "", protein: "", carbs: "", fats: "", fiber: "" });
    setShowManualEntry(false);
    toast.success("Meal logged!");
  };

  const saveMealLog = async () => {
    if (!user || !structuredData || structuredData.length === 0) return;
    setSaving(true);
    try {
      const totalCal = structuredData.reduce((s, i) => s + i.calories, 0);
      const totalProtein = structuredData.reduce((s, i) => s + i.protein_g, 0);
      const totalCarbs = structuredData.reduce((s, i) => s + i.carbs_g, 0);
      const totalFats = structuredData.reduce((s, i) => s + i.fats_g, 0);
      const totalFiber = structuredData.reduce((s, i) => s + i.fiber_g, 0);
      const mealName = structuredData.map(i => i.name).join(", ");

      const { error } = await supabase.from("meal_logs").insert({
        user_id: user.id,
        meal_type: mealType,
        meal_name: mealName,
        items: structuredData as any,
        total_calories: totalCal,
        total_protein_g: totalProtein,
        total_carbs_g: totalCarbs,
        total_fats_g: totalFats,
        total_fiber_g: totalFiber,
      });
      if (error) throw error;
      setSaved(true);
      toast.success("Meal saved to your calorie tracker!");
    } catch {
      toast.error("Failed to save meal");
    } finally {
      setSaving(false);
    }
  };

  if (showTracker) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={resetView}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Nutrition
        </Button>
        <CalorieTracker />
      </div>
    );
  }

  // Meal photo upload screen
  if (showMealUpload && activeAction === "analyze_meal") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={resetView}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-success" />
          <h2 className="text-lg font-semibold">Analyze This Meal</h2>
        </div>
        <p className="text-sm text-muted-foreground">Take a photo or upload an image of your meal for AI-powered nutritional analysis.</p>

        {mealImagePreview ? (
          <div className="relative">
            <img src={mealImagePreview} alt="Meal preview" className="w-full rounded-lg max-h-64 object-cover" />
            <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={clearMealImage}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-success/50 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tap to take photo or upload image</span>
            <span className="text-xs text-muted-foreground">JPG, PNG — max 4MB</span>
            <input ref={mealFileRef} type="file" accept="image/*" onChange={handleMealImageSelect} className="hidden" />
          </label>
        )}

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => handleAction("analyze_meal", mealImageBase64)} disabled={!mealImageBase64}>
            <Camera className="w-4 h-4 mr-1" /> Analyze Meal
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => handleAction("analyze_meal")}>
            Skip Photo
          </Button>
        </div>
      </div>
    );
  }

  if (activeAction && (loading || aiResponse || structuredData)) {
    const card = actionCards.find(c => c.type === activeAction)!;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={resetView}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Nutrition
        </Button>
        <div className="flex items-center gap-2">
          <card.icon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{card.title}</h2>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Analyzing nutrition data...</p>
          </div>
        ) : structuredData ? (
          <div className="space-y-6">
            {usedFallback && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/50 border border-accent">
                <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">For better recommendations, complete your Nutrition Persona in My Profile.</p>
              </div>
            )}
            {activeAction === "analyze_meal" ? (
              <>
                {structuredData.map((item, idx) => (
                  <div key={idx} className="space-y-4">
                    <DetailedNutritionList item={item} />
                    <NutritionCard item={item} hideNutrition />
                  </div>
                ))}
                {structuredData.length >= 2 && <TotalSummaryCard items={structuredData} />}
                {/* Save meal to tracker */}
                <Card className="border-success/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-success font-semibold text-sm">
                      <Save className="w-4 h-4" />
                      Save to Calorie Tracker
                    </div>
                    <Select value={mealType} onValueChange={setMealType}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Meal type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">🌅 Breakfast</SelectItem>
                        <SelectItem value="lunch">☀️ Lunch</SelectItem>
                        <SelectItem value="dinner">🌙 Dinner</SelectItem>
                        <SelectItem value="snack">🍿 Snack</SelectItem>
                        <SelectItem value="other">🍽️ Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      className="w-full"
                      onClick={saveMealLog}
                      disabled={saving || saved}
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4 mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                      {saving ? "Saving..." : saved ? "Saved!" : "Save Meal"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              structuredData.map((item, idx) => (
                <NutritionCard key={idx} item={item} />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {usedFallback && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/50 border border-accent">
                <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">For better recommendations, complete your Nutrition Persona in My Profile.</p>
              </div>
            )}
            <Card>
              <CardContent className="p-4 prose prose-sm max-w-none">
                <ReactMarkdown>{aiResponse}</ReactMarkdown>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Nutrition Advisor</h2>
        <p className="text-xs text-muted-foreground">AI-powered meal guidance tailored to your persona</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actionCards.map(card => (
          <button
            key={card.type}
            onClick={() => handleCardClick(card.type)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all text-center active:scale-[0.97]"
          >
            <div className={`w-12 h-12 rounded-full ${card.color} flex items-center justify-center`}>
              <card.icon className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium">{card.title}</span>
            <span className="text-xs text-muted-foreground">{card.desc}</span>
          </button>
        ))}
      </div>

      {/* Calorie Tracker Button */}
      <Button variant="outline" className="w-full" onClick={() => setShowTracker(true)}>
        <BarChart3 className="w-4 h-4 mr-2" />
        Calorie Tracker
      </Button>
    </div>
  );
};

export default NutritionAdvisor;
