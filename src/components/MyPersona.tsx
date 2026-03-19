import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Loader2, UserCog, Droplets, Activity, Apple, Target, AlertTriangle } from "lucide-react";

interface PersonaData {
  diet_type: string;
  allergies: string[];
  health_goals: string[];
  weight_kg: number | null;
  age: number | null;
  activity_level: string | null;
  medical_conditions: string[];
  dietary_preferences: string[];
  blood_group: string | null;
}

const defaultPersona: PersonaData = {
  diet_type: "vegetarian",
  allergies: [],
  health_goals: [],
  weight_kg: null,
  age: null,
  activity_level: null,
  medical_conditions: [],
  dietary_preferences: [],
  blood_group: null,
};

const activityLevels = [
  { value: "sedentary", label: "Sedentary", desc: "Little or no exercise" },
  { value: "light", label: "Lightly Active", desc: "Light exercise 1-3 days/week" },
  { value: "moderate", label: "Moderately Active", desc: "Moderate exercise 3-5 days/week" },
  { value: "active", label: "Active", desc: "Hard exercise 6-7 days/week" },
  { value: "very_active", label: "Very Active", desc: "Very hard exercise, physical job" },
];

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const MyPersona = () => {
  const { user, profile } = useAuth();
  const [persona, setPersona] = useState<PersonaData>(defaultPersona);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Comma-separated string helpers
  const [allergiesInput, setAllergiesInput] = useState("");
  const [goalsInput, setGoalsInput] = useState("");
  const [conditionsInput, setConditionsInput] = useState("");
  const [preferencesInput, setPreferencesInput] = useState("");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch persona and health_profile in parallel
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
        age: p?.age ?? null,
        activity_level: (p as any)?.activity_level ?? null,
        medical_conditions: (p as any)?.medical_conditions?.length ? (p as any).medical_conditions : (h?.chronic_conditions ?? []),
        dietary_preferences: (p as any)?.dietary_preferences ?? [],
        blood_group: (p as any)?.blood_group ?? (h?.blood_group ?? null),
      };

      // Pre-fill age from profile DOB if not set
      if (!merged.age && profile?.date_of_birth) {
        const dob = new Date(profile.date_of_birth);
        merged.age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }

      setPersona(merged);
      setAllergiesInput(merged.allergies.join(", "));
      setGoalsInput(merged.health_goals.join(", "));
      setConditionsInput(merged.medical_conditions.join(", "));
      setPreferencesInput(merged.dietary_preferences.join(", "));
    } catch {
      // First time — use defaults
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
      health_goals: goalsInput.split(",").map(s => s.trim()).filter(Boolean),
      weight_kg: persona.weight_kg,
      age: persona.age,
      activity_level: persona.activity_level,
      medical_conditions: conditionsInput.split(",").map(s => s.trim()).filter(Boolean),
      dietary_preferences: preferencesInput.split(",").map(s => s.trim()).filter(Boolean),
      blood_group: persona.blood_group,
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

      {/* Basic Info */}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Weight (kg)</Label>
              <Input type="number" value={persona.weight_kg ?? ""} onChange={e => setPersona(p => ({ ...p, weight_kg: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <Label>Age</Label>
              <Input type="number" value={persona.age ?? ""} onChange={e => setPersona(p => ({ ...p, age: e.target.value ? Number(e.target.value) : null }))} />
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

      {/* Activity Level */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Activity Level
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Dietary Preferences & Goals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-success" /> Preferences & Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Dietary Preferences (comma-separated)</Label>
            <Input value={preferencesInput} onChange={e => setPreferencesInput(e.target.value)} placeholder="e.g. low salt, high protein, no sugar" />
          </div>
          <div>
            <Label>Health Goals (comma-separated)</Label>
            <Input value={goalsInput} onChange={e => setGoalsInput(e.target.value)} placeholder="e.g. weight loss, muscle gain, better sleep" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Save Persona
      </Button>
    </div>
  );
};

export default MyPersona;
