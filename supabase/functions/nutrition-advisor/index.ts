import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonFormatBase = `IMPORTANT: You MUST respond ONLY with a valid JSON array. No markdown, no code fences, no extra text. Each item in the array is a meal/food object with these fields:
- name (string): meal/food name
- description (string): brief description
- calories (number): total kcal
- protein_g (number): grams of protein
- carbs_g (number): grams of carbs
- fats_g (number): grams of fat
- fiber_g (number): grams of fiber
- health_benefits (string[]): list of health benefit bullet points personalized to user
- potential_issues (string[]): list of potential concerns personalized to user
- health_rating (number 1-10): overall health rating for this user
- suggestions (string[]): improvement tips

Example: [{"name":"Oats Porridge","description":"Steel-cut oats with milk","calories":220,"protein_g":8,"carbs_g":38,"fats_g":4,"fiber_g":5,"health_benefits":["High fiber aids digestion"],"potential_issues":["Add protein source"],"health_rating":7,"suggestions":["Top with nuts"]}]`;

const jsonFormatAnalyze = `IMPORTANT: You MUST respond ONLY with a valid JSON array. No markdown, no code fences, no extra text. Each item in the array is a meal/food ingredient object with ALL of these fields:
- name (string): ingredient/food name
- description (string): brief description
- calories (number): total kcal
- protein_g (number): grams of protein
- carbs_g (number): grams of carbs
- fats_g (number): grams of total fat
- saturated_fat_g (number): grams of saturated fat
- polyunsaturated_fat_g (number): grams of polyunsaturated fat
- monounsaturated_fat_g (number): grams of monounsaturated fat
- trans_fat_g (number): grams of trans fat
- cholesterol_mg (number): milligrams of cholesterol
- sodium_mg (number): milligrams of sodium
- potassium_mg (number): milligrams of potassium
- fiber_g (number): grams of fiber
- sugar_g (number): grams of sugar
- vitamin_a_iu (number): IU of Vitamin A
- vitamin_c_mg (number): mg of Vitamin C
- calcium_mg (number): mg of Calcium
- iron_mg (number): mg of Iron
- health_benefits (string[]): list of health benefit bullet points personalized to user
- potential_issues (string[]): list of potential concerns personalized to user
- health_rating (number 1-10): overall health rating for this user
- suggestions (string[]): improvement tips
- confidence (number 0-100): how confident you are about correctly identifying this food item from the image. 100 means absolutely certain, below 80 means uncertain.
- alternatives (string[]): if confidence is below 80, list 2-3 other foods this could possibly be. If confidence >= 80, return an empty array.

CRITICAL IDENTIFICATION RULES:
- Pay very close attention to food textures, colors, and cooking styles to distinguish visually similar foods.
- Indian cuisine context is essential: brinjal/baingan (eggplant) slices are NOT banana slices — brinjal is purple-skinned with white-green flesh and visible seeds when cooked. Banana slices are uniformly pale yellow/white with no seeds.
- Avocado slices have a creamy, buttery green flesh with a large pit mark — do NOT confuse with cucumber which has visible seeds in a watery center and a thin green skin.
- Other commonly confused foods: lauki (bottle gourd) vs zucchini, tinda vs apple gourd, raw papaya vs mango, paneer vs tofu, poha vs upma, sevai vs noodles.
- When uncertain, set a lower confidence score and list the alternatives.

Use 0 for any nutritional field you cannot estimate. Return each distinct ingredient/food item separately.
Example: [{"name":"Dal Tadka","description":"Yellow lentils tempered with spices","calories":180,"protein_g":12,"carbs_g":22,"fats_g":6,"saturated_fat_g":1,"polyunsaturated_fat_g":1,"monounsaturated_fat_g":3,"trans_fat_g":0,"cholesterol_mg":0,"sodium_mg":400,"potassium_mg":350,"fiber_g":4,"sugar_g":2,"vitamin_a_iu":50,"vitamin_c_mg":3,"calcium_mg":30,"iron_mg":3,"health_benefits":["High protein"],"potential_issues":["Sodium from salt"],"health_rating":7,"suggestions":["Use less oil"],"confidence":92,"alternatives":[]}]`;

const systemPrompts: Record<string, string> = {
  meal_plan: `You are an Indian nutrition advisor. Suggest a detailed meal plan for the current time of day (breakfast/lunch/dinner/snack based on IST). Use Indian cuisine. Personalize based on the user's persona including their activity level, medical conditions, dietary preferences, and goals. Suggest 2-4 food items. ${jsonFormatBase}`,
  analyze_meal: `You are an expert nutrition analyst specializing in Indian and South Asian cuisine. Analyze the meal shown in the image (or described by the user). Provide a comprehensive nutritional breakdown including all macronutrients, micronutrients, vitamins and minerals.

CRITICAL: Carefully identify each food item. Many Indian foods look similar — pay close attention to texture, color, cooking method, and context clues (plate type, other items on the plate, typical meal combinations). Consider the user's medical conditions and dietary restrictions. Return each distinct food item/ingredient as a separate object. ${jsonFormatAnalyze}`,
  post_workout: `You are a sports nutritionist specializing in Indian cuisine. Suggest a post-workout recovery meal with protein, carbs, and hydration tips. Personalize based on the user's persona including activity level and fitness goals. Suggest 2-3 food items. ${jsonFormatBase}`,
  feeling_unwell: `You are a gentle nutrition advisor. Suggest easy-to-digest, soothing Indian meals for someone who is not feeling well. Include khichdi, soups, and light options. Consider the user's medical conditions and allergies carefully. Suggest 2-3 food items. ${jsonFormatBase}`,
  reanalyze_item: `You are an expert nutrition analyst specializing in Indian and South Asian cuisine. The user has corrected the name of a food item that was previously misidentified from a meal photo. Given the corrected food item name, return its detailed and accurate nutritional breakdown as a single-item JSON array. Be precise with the nutritional values for this specific food item. Consider typical Indian serving sizes and preparation methods. ${jsonFormatAnalyze}`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, persona, image, foodName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = systemPrompts[type] || systemPrompts.meal_plan;

    const personaContext = persona
      ? `User persona: Diet=${persona.diet_type}, Allergies=${(persona.allergies || []).join(", ") || "none"}, Goals=${(persona.health_goals || []).join(", ") || "general health"}, Weight=${persona.weight_kg || "unknown"}kg, Height=${persona.height_m || "unknown"}m, Age=${persona.age || "unknown"}, Activity Level=${persona.activity_level || "unknown"}, Medical Conditions=${(persona.medical_conditions || []).join(", ") || "none"}, Dietary Preferences=${(persona.dietary_preferences || []).join(", ") || "none"}, Blood Group=${persona.blood_group || "unknown"}, Smoking=${persona.smoking || "unknown"}, Alcohol=${persona.alcohol || "unknown"}.`
      : "No persona provided.";

    const now = new Date();
    const istHour = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() >= 30 ? 1 : 0);
    const timeContext = `Current IST hour is approximately ${istHour}:00.`;

    // Use gemini-2.5-pro for image analysis (strongest vision model), gemini-3-flash for text
    const model = image ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";

    let messages: any[];
    if (type === "reanalyze_item" && foodName) {
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${personaContext}\n${timeContext}\n\nPlease provide a detailed and accurate nutritional breakdown for this food item: "${foodName}". Consider typical Indian serving sizes and preparation methods. Return exactly one item in the JSON array with confidence set to 100.` },
      ];
    } else if (image && type === "analyze_meal") {
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `${personaContext}\n${timeContext}\n\nPlease carefully analyze this meal image. Pay close attention to food textures, colors, and cooking styles to accurately identify each item. This is likely Indian cuisine — consider that context when identifying foods.` },
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
