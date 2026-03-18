import { useState, useEffect } from "react";
import { UtensilsCrossed, Camera, Dumbbell, Thermometer, UserCog, Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type ActionType = "meal_plan" | "analyze_meal" | "post_workout" | "feeling_unwell";

interface Persona {
  diet_type: string;
  allergies: string[];
  health_goals: string[];
  weight_kg: number | null;
  age: number | null;
}

const defaultPersona: Persona = {
  diet_type: "vegetarian",
  allergies: [],
  health_goals: [],
  weight_kg: null,
  age: null,
};

const actionCards = [
  { type: "meal_plan" as ActionType, icon: UtensilsCrossed, title: "Suggest a Meal Plan", desc: "Personalized for this time of day", color: "bg-primary/10 text-primary" },
  { type: "analyze_meal" as ActionType, icon: Camera, title: "Analyze This Meal", desc: "Photo scan for calories & nutrients", color: "bg-success/10 text-success" },
  { type: "post_workout" as ActionType, icon: Dumbbell, title: "Post-Workout Recovery", desc: "Recovery meal based on your activity", color: "bg-primary/10 text-primary" },
  { type: "feeling_unwell" as ActionType, icon: Thermometer, title: "I'm Not Feeling Well", desc: "Gentle meal plan for recovery", color: "bg-sos/10 text-sos" },
];

const NutritionAdvisor = () => {
  const { user } = useAuth();
  const [persona, setPersona] = useState<Persona>(defaultPersona);
  const [editPersona, setEditPersona] = useState<Persona>(defaultPersona);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [aiResponse, setAiResponse] = useState("");
  const [allergiesInput, setAllergiesInput] = useState("");
  const [goalsInput, setGoalsInput] = useState("");

  useEffect(() => {
    if (user) fetchPersona();
  }, [user]);

  const fetchPersona = async () => {
    const { data } = await supabase
      .from("nutrition_personas")
      .select("*")
      .eq("user_id", user!.id)
      .single();
    if (data) {
      const p: Persona = {
        diet_type: data.diet_type,
        allergies: data.allergies ?? [],
        health_goals: data.health_goals ?? [],
        weight_kg: data.weight_kg,
        age: data.age,
      };
      setPersona(p);
      setEditPersona(p);
      setAllergiesInput((data.allergies ?? []).join(", "));
      setGoalsInput((data.health_goals ?? []).join(", "));
    }
  };

  const savePersona = async () => {
    const toSave = {
      ...editPersona,
      allergies: allergiesInput.split(",").map(s => s.trim()).filter(Boolean),
      health_goals: goalsInput.split(",").map(s => s.trim()).filter(Boolean),
    };
    const { error } = await supabase.from("nutrition_personas").upsert({
      user_id: user!.id,
      ...toSave,
    }, { onConflict: "user_id" });
    if (error) { toast.error("Failed to save persona"); return; }
    setPersona(toSave);
    setDialogOpen(false);
    toast.success("Persona saved!");
  };

  const handleAction = async (type: ActionType) => {
    setActiveAction(type);
    setAiResponse("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nutrition-advisor", {
        body: { type, persona },
      });
      if (error) throw error;
      setAiResponse(data?.response || "No response received.");
    } catch (e: any) {
      if (e?.message?.includes("429")) toast.error("Rate limited. Try again shortly.");
      else if (e?.message?.includes("402")) toast.error("AI credits exhausted. Please top up.");
      else toast.error("Something went wrong.");
      setActiveAction(null);
    } finally {
      setLoading(false);
    }
  };

  if (activeAction && (loading || aiResponse)) {
    const card = actionCards.find(c => c.type === activeAction)!;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setActiveAction(null); setAiResponse(""); }}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <card.icon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{card.title}</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 prose prose-sm max-w-none">
              <ReactMarkdown>{aiResponse}</ReactMarkdown>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Nutrition Advisor</h2>
          <p className="text-xs text-muted-foreground">AI-powered meal guidance tailored to you</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => {
              setEditPersona(persona);
              setAllergiesInput(persona.allergies.join(", "));
              setGoalsInput(persona.health_goals.join(", "));
            }}>
              <UserCog className="w-4 h-4 mr-1" /> Edit Persona
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Your Nutrition Persona</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Diet Type</Label>
                <Select value={editPersona.diet_type} onValueChange={v => setEditPersona(p => ({ ...p, diet_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vegetarian">Vegetarian</SelectItem>
                    <SelectItem value="non-vegetarian">Non-Vegetarian</SelectItem>
                    <SelectItem value="vegan">Vegan</SelectItem>
                    <SelectItem value="eggetarian">Eggetarian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Allergies (comma-separated)</Label>
                <Input value={allergiesInput} onChange={e => setAllergiesInput(e.target.value)} placeholder="e.g. peanuts, dairy" />
              </div>
              <div>
                <Label>Health Goals (comma-separated)</Label>
                <Input value={goalsInput} onChange={e => setGoalsInput(e.target.value)} placeholder="e.g. weight loss, muscle gain" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Weight (kg)</Label>
                  <Input type="number" value={editPersona.weight_kg ?? ""} onChange={e => setEditPersona(p => ({ ...p, weight_kg: e.target.value ? Number(e.target.value) : null }))} />
                </div>
                <div>
                  <Label>Age</Label>
                  <Input type="number" value={editPersona.age ?? ""} onChange={e => setEditPersona(p => ({ ...p, age: e.target.value ? Number(e.target.value) : null }))} />
                </div>
              </div>
              <Button onClick={savePersona} className="w-full">Save Persona</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 gap-3">
        {actionCards.map(card => (
          <button
            key={card.type}
            onClick={() => handleAction(card.type)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all text-center"
          >
            <div className={`w-12 h-12 rounded-full ${card.color} flex items-center justify-center`}>
              <card.icon className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium">{card.title}</span>
            <span className="text-xs text-muted-foreground">{card.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default NutritionAdvisor;
