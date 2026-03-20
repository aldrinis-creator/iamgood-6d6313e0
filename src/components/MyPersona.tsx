import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInYears } from "date-fns";
import { Save, Loader2, UserCog, Droplets, Activity, Apple, Target, CalendarIcon, Ruler, Wine, Cigarette, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PersonaData {
  diet_type: string;
  allergies: string[];
  health_goals: string[];
  weight_kg: number | null;
  height_m: number | null;
  date_of_birth: string | null;
  activity_level: string | null;
  medical_conditions: string[];
  dietary_preferences: string[];
  blood_group: string | null;
  smoking: string | null;
  alcohol: string | null;
}

const defaultPersona: PersonaData = {
  diet_type: "vegetarian",
  allergies: [],
  health_goals: [],
  weight_kg: null,
  height_m: null,
  date_of_birth: null,
  activity_level: null,
  medical_conditions: [],
  dietary_preferences: [],
  blood_group: null,
  smoking: null,
  alcohol: null,
};

const activityLevels = [
  { value: "sedentary", label: "Sedentary", desc: "Little or no exercise" },
  { value: "light", label: "Lightly Active", desc: "Light exercise 1-3 days/week" },
  { value: "moderate", label: "Moderately Active", desc: "Moderate exercise 3-5 days/week" },
  { value: "active", label: "Active", desc: "Hard exercise 6-7 days/week" },
  { value: "very_active", label: "Very Active", desc: "Very hard exercise, physical job" },
];

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const PREFERENCE_OPTIONS = [
  "Low Salt", "Low Sugar", "High Protein", "High Fiber",
  "Low Carb", "Keto-friendly", "Gluten-free", "Lactose-free",
  "Organic Only", "No Processed Food", "Low Fat", "Heart-healthy",
];

const GOAL_OPTIONS = [
  "Weight Loss", "Weight Gain", "Muscle Gain", "Better Sleep",
  "Manage Diabetes", "Lower Cholesterol", "Improve Digestion",
  "Boost Immunity", "Reduce Stress", "Increase Energy",
  "Manage Blood Pressure", "Healthy Aging",
];

/* ─── Multi-select chip picker ─── */
const ChipPicker = ({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) => {
  const [otherValue, setOtherValue] = useState("");

  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter(s => s !== item) : [...selected, item]);
  };

  const addOther = () => {
    const v = otherValue.trim();
    if (v && !selected.includes(v)) {
      onChange([...selected, v]);
    }
    setOtherValue("");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <Badge
            key={opt}
            variant={selected.includes(opt) ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => toggle(opt)}
          >
            {opt}
            {selected.includes(opt) && <X className="w-3 h-3 ml-1" />}
          </Badge>
        ))}
        {/* Show custom items not in options */}
        {selected.filter(s => !options.includes(s)).map(custom => (
          <Badge key={custom} variant="default" className="cursor-pointer text-xs" onClick={() => toggle(custom)}>
            {custom} <X className="w-3 h-3 ml-1" />
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Other (type & add)"
          value={otherValue}
          onChange={e => setOtherValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addOther())}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={addOther} disabled={!otherValue.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
};

const MyPersonaContent = () => {
  const { user, profile } = useAuth();
  const [persona, setPersona] = useState<PersonaData>(defaultPersona);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allergiesInput, setAllergiesInput] = useState("");
  const [conditionsInput, setConditionsInput] = useState("");

  const age = useMemo(() => {
    if (!persona.date_of_birth) return null;
    return differenceInYears(new Date(), new Date(persona.date_of_birth));
  }, [persona.date_of_birth]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [personaRes, healthRes] = await Promise.all([
        supabase.from("nutrition_personas").select("*").eq("user_id", user!.id).single(),
        supabase.from("health_profile").select("*").eq("user_id", user!.id).single(),
      ]);

      const p = personaRes.data;
      const h = healthRes.data;

      const merged: PersonaData = {
        diet_type: p?.diet_type || "vegetarian",
        allergies: p?.allergies?.length ? p.allergies : (h?.allergies ?? []),
        health_goals: p?.health_goals ?? [],
        weight_kg: p?.weight_kg ?? (profile?.weight_kg ?? null),
        height_m: (p as any)?.height_m ?? (profile?.height_m ?? null),
        date_of_birth: (p as any)?.date_of_birth ?? (profile?.date_of_birth ?? null),
        activity_level: p?.activity_level ?? null,
        medical_conditions: p?.medical_conditions?.length ? p.medical_conditions : (h?.chronic_conditions ?? []),
        dietary_preferences: p?.dietary_preferences ?? [],
        blood_group: p?.blood_group ?? (h?.blood_group ?? null),
        smoking: (p as any)?.smoking ?? null,
        alcohol: (p as any)?.alcohol ?? null,
      };

      setPersona(merged);
      setAllergiesInput(merged.allergies.join(", "));
      setConditionsInput(merged.medical_conditions.join(", "));
    } catch {
      // First time — use defaults, pre-fill from profile
      if (profile) {
        setPersona(prev => ({
          ...prev,
          weight_kg: profile.weight_kg ?? null,
          height_m: profile.height_m ?? null,
          date_of_birth: profile.date_of_birth ?? null,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const toSave = {
      user_id: user.id,
      diet_type: persona.diet_type,
      allergies: allergiesInput.split(",").map(s => s.trim()).filter(Boolean),
      health_goals: persona.health_goals,
      weight_kg: persona.weight_kg,
      height_m: persona.height_m,
      date_of_birth: persona.date_of_birth,
      age: age,
      activity_level: persona.activity_level,
      medical_conditions: conditionsInput.split(",").map(s => s.trim()).filter(Boolean),
      dietary_preferences: persona.dietary_preferences,
      blood_group: persona.blood_group,
      smoking: persona.smoking,
      alcohol: persona.alcohol,
    };

    const { error } = await supabase.from("nutrition_personas").upsert(toSave as any, { onConflict: "user_id" });
    setSaving(false);

    if (error) {
      toast.error("Failed to save persona");
      console.error(error);
    } else {
      toast.success("Persona saved!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserCog className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">My Persona</h2>
      </div>
      <p className="text-xs text-muted-foreground">Your health profile powers AI-driven nutrition advice and health insights.</p>

      {/* Diet & Basics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Apple className="w-4 h-4 text-success" /> Diet & Basics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Diet Type</Label>
            <Select value={persona.diet_type} onValueChange={v => setPersona(p => ({ ...p, diet_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vegetarian">Vegetarian</SelectItem>
                <SelectItem value="non-vegetarian">Non-Vegetarian</SelectItem>
                <SelectItem value="vegan">Vegan</SelectItem>
                <SelectItem value="eggetarian">Eggetarian</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* DOB + Age */}
          <div>
            <Label>Date of Birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !persona.date_of_birth && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {persona.date_of_birth ? format(new Date(persona.date_of_birth), "dd MMM yyyy") : "Select date of birth"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={persona.date_of_birth ? new Date(persona.date_of_birth) : undefined}
                  onSelect={d => setPersona(p => ({ ...p, date_of_birth: d ? format(d, "yyyy-MM-dd") : null }))}
                  disabled={d => d > new Date() || d < new Date("1900-01-01")}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  captionLayout="dropdown-buttons"
                  fromYear={1920}
                  toYear={new Date().getFullYear()}
                />
              </PopoverContent>
            </Popover>
            {age !== null && (
              <p className="text-xs text-muted-foreground mt-1">Age: <span className="font-semibold text-foreground">{age} years</span></p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Weight (kg)</Label>
              <Input type="number" value={persona.weight_kg ?? ""} onChange={e => setPersona(p => ({ ...p, weight_kg: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Ruler className="w-3 h-3" /> Height (m)</Label>
              <Input type="number" step="0.01" placeholder="e.g. 1.72" value={persona.height_m ?? ""} onChange={e => setPersona(p => ({ ...p, height_m: e.target.value ? Number(e.target.value) : null }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Body & Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Droplets className="w-4 h-4 text-destructive" /> Body & Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Blood Group</Label>
            <Select value={persona.blood_group || ""} onValueChange={v => setPersona(p => ({ ...p, blood_group: v }))}>
              <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
              <SelectContent>
                {bloodGroups.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Allergies (comma-separated)</Label>
            <Input value={allergiesInput} onChange={e => setAllergiesInput(e.target.value)} placeholder="e.g. peanuts, dairy, gluten" />
          </div>
          <div>
            <Label>Medical Conditions (comma-separated)</Label>
            <Input value={conditionsInput} onChange={e => setConditionsInput(e.target.value)} placeholder="e.g. diabetes, hypertension" />
          </div>
        </CardContent>
      </Card>

      {/* Lifestyle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Lifestyle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Activity Level</Label>
            <Select value={persona.activity_level || ""} onValueChange={v => setPersona(p => ({ ...p, activity_level: v }))}>
              <SelectTrigger><SelectValue placeholder="Select activity level" /></SelectTrigger>
              <SelectContent>
                {activityLevels.map(al => (
                  <SelectItem key={al.value} value={al.value}>
                    {al.label} — {al.desc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1"><Cigarette className="w-3 h-3" /> Smoking</Label>
              <Select value={persona.smoking || ""} onValueChange={v => setPersona(p => ({ ...p, smoking: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="occasionally">Occasionally</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-1"><Wine className="w-3 h-3" /> Alcohol</Label>
              <Select value={persona.alcohol || ""} onValueChange={v => setPersona(p => ({ ...p, alcohol: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="occasionally">Occasionally</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences & Goals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-success" /> Preferences & Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChipPicker
            label="Dietary Preferences"
            options={PREFERENCE_OPTIONS}
            selected={persona.dietary_preferences}
            onChange={v => setPersona(p => ({ ...p, dietary_preferences: v }))}
          />
          <ChipPicker
            label="Health Goals"
            options={GOAL_OPTIONS}
            selected={persona.health_goals}
            onChange={v => setPersona(p => ({ ...p, health_goals: v }))}
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Save Persona
      </Button>
    </div>
  );
};

const MyPersona = () => {
  return (
    <VaultGate title="My Persona">
      <MyPersonaContent />
    </VaultGate>
  );
};

export default MyPersona;
