import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  meal_plan: `You are an Indian nutrition advisor. Suggest a detailed meal plan for the current time of day (breakfast/lunch/dinner/snack based on IST). Include calories, macros, and preparation tips. Use Indian cuisine. Personalize based on the user's persona including their activity level, medical conditions, dietary preferences, and goals.`,
  analyze_meal: `You are a nutrition analyst. Analyze the meal shown in the image (or described by the user). Provide a detailed calorie breakdown, macros (protein, carbs, fat, fiber), health rating (1-10), and suggestions for improvement. Use Indian cuisine context. Consider the user's medical conditions and dietary restrictions.`,
  post_workout: `You are a sports nutritionist specializing in Indian cuisine. Suggest a post-workout recovery meal with protein, carbs, and hydration tips. Personalize based on the user's persona including activity level and fitness goals.`,
  feeling_unwell: `You are a gentle nutrition advisor. Suggest easy-to-digest, soothing Indian meals for someone who is not feeling well. Include khichdi, soups, and light options. Consider the user's medical conditions and allergies carefully.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, persona, image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = systemPrompts[type] || systemPrompts.meal_plan;

    const personaContext = persona
      ? `User persona: Diet=${persona.diet_type}, Allergies=${(persona.allergies || []).join(", ") || "none"}, Goals=${(persona.health_goals || []).join(", ") || "general health"}, Weight=${persona.weight_kg || "unknown"}kg, Height=${persona.height_m || "unknown"}m, Age=${persona.age || "unknown"}, Activity Level=${persona.activity_level || "unknown"}, Medical Conditions=${(persona.medical_conditions || []).join(", ") || "none"}, Dietary Preferences=${(persona.dietary_preferences || []).join(", ") || "none"}, Blood Group=${persona.blood_group || "unknown"}, Smoking=${persona.smoking || "unknown"}, Alcohol=${persona.alcohol || "unknown"}.`
      : "No persona provided.";

    const now = new Date();
    const istHour = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() >= 30 ? 1 : 0);
    const timeContext = `Current IST hour is approximately ${istHour}:00.`;

    const model = image ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview";

    let messages: any[];
    if (image && type === "analyze_meal") {
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `${personaContext}\n${timeContext}\n\nPlease analyze this meal image and provide a detailed nutritional breakdown.` },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ];
    } else {
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${personaContext}\n${timeContext}\n\nPlease provide your recommendation.` },
      ];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "No response generated.";

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nutrition-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
