import { useState, useRef } from "react";
import { UtensilsCrossed, Camera, Dumbbell, Thermometer, Loader2, ArrowLeft, X, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type ActionType = "meal_plan" | "analyze_meal" | "post_workout" | "feeling_unwell";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

const actionCards = [
  { type: "meal_plan" as ActionType, icon: UtensilsCrossed, title: "Suggest a Meal Plan", desc: "Personalized for this time of day", color: "bg-primary/10 text-primary" },
  { type: "analyze_meal" as ActionType, icon: Camera, title: "Analyze This Meal", desc: "Photo scan for calories & nutrients", color: "bg-success/10 text-success" },
  { type: "post_workout" as ActionType, icon: Dumbbell, title: "Post-Workout Recovery", desc: "Recovery meal based on your activity", color: "bg-primary/10 text-primary" },
  { type: "feeling_unwell" as ActionType, icon: Thermometer, title: "I'm Not Feeling Well", desc: "Gentle meal plan for recovery", color: "bg-sos/10 text-sos" },
];

const NutritionAdvisor = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [aiResponse, setAiResponse] = useState("");

  // Meal photo state
  const [mealImagePreview, setMealImagePreview] = useState<string | null>(null);
  const [mealImageBase64, setMealImageBase64] = useState<string | null>(null);
  const [showMealUpload, setShowMealUpload] = useState(false);
  const mealFileRef = useRef<HTMLInputElement>(null);

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

  const handleAction = async (type: ActionType, image?: string | null) => {
    setActiveAction(type);
    setAiResponse("");
    setLoading(true);
    setShowMealUpload(false);
    try {
      // Fetch persona for AI context
      let persona = null;
      if (user) {
        const { data } = await supabase.from("nutrition_personas").select("*").eq("user_id", user.id).single();
        if (data) persona = data;
      }

      const body: any = { type, persona };
      if (image) body.image = image;
      const { data, error } = await supabase.functions.invoke("nutrition-advisor", { body });
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

  const handleCardClick = (type: ActionType) => {
    if (type === "analyze_meal") {
      setShowMealUpload(true);
      setActiveAction(type);
      clearMealImage();
    } else {
      handleAction(type);
    }
  };

  // Meal photo upload screen
  if (showMealUpload && activeAction === "analyze_meal") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setShowMealUpload(false); setActiveAction(null); clearMealImage(); }}>
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

  if (activeAction && (loading || aiResponse)) {
    const card = actionCards.find(c => c.type === activeAction)!;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setActiveAction(null); setAiResponse(""); clearMealImage(); }}>
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
      <div>
        <h2 className="text-lg font-bold">Nutrition Advisor</h2>
        <p className="text-xs text-muted-foreground">AI-powered meal guidance tailored to your persona</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actionCards.map(card => (
          <button
            key={card.type}
            onClick={() => handleCardClick(card.type)}
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
