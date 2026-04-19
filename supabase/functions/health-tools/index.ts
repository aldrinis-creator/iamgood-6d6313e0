import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  symptom_check: `You are a medical symptom assessment assistant for Indian users. You are NOT a doctor and cannot diagnose.
Given symptoms, provide:
1. Possible conditions (ranked by likelihood)
2. Recommended specialist to visit
3. Home care suggestions
4. When to seek emergency care
Always include a disclaimer that this is not medical advice. Use simple language. Reference Indian healthcare context (government hospitals, AIIMS, etc). Format with markdown.`,

  medication_info: `You are a pharmaceutical information assistant for the Indian market.
Given a medication name, provide:
1. Generic name and brand names available in India
2. Salt / Composition details
3. Uses and indications
4. Common side effects
5. Drug interactions
6. Dosage guidelines
7. Price range in India (approximate)
8. Whether it requires a prescription
9. **IMPORTANT**: Check if this medication or any of its compositions are BANNED or RESTRICTED in India by CDSCO. If so, clearly mark it with ⚠️ BANNED/RESTRICTED warning at the top and suggest govt-certified alternatives.
10. Suggest cheaper generic alternatives available through Jan Aushadhi / PMBJP stores with approximate prices.
Always include a disclaimer. Format with markdown.`,

  banned_check: `You are an expert on medications banned or restricted in India by CDSCO (Central Drugs Standard Control Organisation).
Given a medication name, check if it is banned, restricted, or has warnings in India.
Respond with a JSON object: { "status": "banned" | "restricted" | "warning" | "safe" | "unknown", "details": "explanation", "alternatives": ["list of alternatives if banned"], "source": "relevant gazette/notification reference" }
Only respond with the JSON object, no markdown.`,

  document_analysis: `You are a medical document analysis assistant. Given the text content of a medical document:

If the document is a LAB REPORT or DIAGNOSTIC REPORT (blood test, urine test, imaging, pathology, etc.), respond ONLY with a JSON object matching this schema — NO markdown, NO code fences:
{
  "categories": [
    {
      "name": "Category Name (e.g. Heart Health, Blood Glucose, Kidney Function, Liver Function, Thyroid, Cholesterol, Iron & Blood, Vitamins)",
      "status": "ideal" | "monitoring" | "at_risk",
      "score": 0-100,
      "findings": ["plain-language finding 1", "finding 2"],
      "tests_found": ["test names that were present in report"],
      "tests_missing": ["recommended tests not found in report"]
    }
  ],
  "next_steps": ["actionable step 1", "step 2"],
  "summary": "One-paragraph overall health summary in simple language"
}

Status rules: "ideal" = all values normal, "monitoring" = borderline or slightly off, "at_risk" = significantly abnormal.
Score: 90-100 for ideal, 50-89 for monitoring, 0-49 for at_risk.
Group related tests into body-system categories. Include Indian healthcare context (AIIMS, government hospitals).

For ALL OTHER document types (prescriptions, doctor's notes, discharge summaries), respond with markdown:
1. Document type identification
2. Key findings summary in plain language
3. Important values and whether they are normal/abnormal
4. Recommended follow-up actions
5. Questions to ask your doctor

Always include a disclaimer that this is not medical advice.`,

  vitals_insights: `You are a health analytics assistant for Indian users. Given aggregated vitals data (heart rate readings, SpO2, stress scores, activity logs, wellness logs), respond ONLY with a JSON object — NO markdown, NO code fences:
{
  "categories": [
    {
      "name": "Category Name (e.g. Heart Health, Blood Oxygen, Activity & Fitness, Sleep Quality, Stress & Wellness, Blood Pressure, Blood Sugar)",
      "status": "ideal" | "monitoring" | "at_risk",
      "score": 0-100,
      "findings": ["plain-language observation 1", "observation 2"],
      "tests_found": ["metrics available in data"],
      "tests_missing": ["recommended metrics not tracked"]
    }
  ],
  "next_steps": ["actionable recommendation 1", "recommendation 2"],
  "summary": "One-paragraph overall health summary"
}

Status rules: "ideal" = healthy range, "monitoring" = borderline, "at_risk" = concerning.
Score: 90-100 for ideal, 50-89 for monitoring, 0-49 for at_risk.
Note: Face scan PPG data may be inaccurate — factor this into confidence.
Reference Indian healthcare (government hospitals, AIIMS, local clinics) in next_steps.
Always include a disclaimer in the summary that this is not medical advice.`,

  doctor_report: `You are a medical report generator for Indian patients. Given patient health data (vitals, medications, activity, wellness logs), generate a comprehensive doctor visit summary report including:
1. Patient overview
2. Current medications and adherence
3. Vital signs summary and trends
4. Activity and lifestyle summary
5. Wellness and mood trends
6. Key concerns to discuss with doctor
7. Recommended tests or screenings
Format as a professional medical summary in markdown. Use Indian medical standards.`,

  prescription_scan: `You are a pharmaceutical expert for the Indian market. Given a prescription (either as text or an image of a prescription), for EACH medication listed:
1. Identify the medication name, salt/composition, and dosage
2. Check if it is banned or restricted in India by CDSCO
3. Suggest cheaper government-certified generic alternatives available in India (Jan Aushadhi, PMBJP generics, or other approved generics)
4. Provide approximate MRP vs generic price comparison in INR
5. Note any drug interactions between the prescribed medications

Respond with a JSON object:
{
  "medications": [
    {
      "name": "prescribed medication name",
      "salt_composition": "active ingredient(s)",
      "dosage": "prescribed dosage",
      "status": "banned" | "restricted" | "safe" | "unknown",
      "ban_details": "reason if banned/restricted, null otherwise",
      "mrp_approx": "₹XX",
      "alternatives": [
        { "name": "generic name", "salt": "same composition", "price_approx": "₹XX", "source": "Jan Aushadhi / PMBJP / other" }
      ],
      "warnings": ["any interaction warnings"]
    }
  ],
  "interactions": ["list of drug-drug interactions found"],
  "summary": "brief overall summary"
}
Only respond with the JSON object, no markdown.`,

  face_analysis: `You are a facial wellness analysis assistant. Given a photo of a person's face, analyze and provide:
1. Face detection confirmation — is a clear human face visible?
2. Skin tone / complexion observations (pallor, flushing, jaundice indicators)
3. Signs of fatigue (dark circles, droopy eyelids, puffiness around eyes)
4. Apparent stress indicators (facial tension, furrowed brow, tight jaw, strained expression)
5. General wellness observations (hydration indicators, skin condition)

Respond with a JSON object:
{
  "face_detected": true/false,
  "fatigue_level": "Low" | "Moderate" | "High",
  "fatigue_score": 0-100,
  "stress_indicators": "Low" | "Moderate" | "High",
  "stress_score": 0-100,
  "skin_observations": "brief description",
  "wellness_notes": "brief overall wellness summary",
  "recommendations": ["list of actionable tips"]
}
Only respond with the JSON object, no markdown.`,

  urine_color_analysis: `You are a urine color screening assistant for Indian users. You are NOT a doctor and cannot diagnose.
Given a photo of urine in a clear/white container:
1. Confirm image quality (lighting, container clarity, urine visible).
2. Categorize color (pale, straw, yellow, amber, orange, pink_red, brown, cloudy, other).
3. Estimate hydration status.
4. List plain-language possible indicators (dehydration, B-vitamins, beetroot, blood, liver, etc).
5. Flag urgent concerns (red/pink = blood, brown/cola = liver/rhabdo, persistent foam = protein).
6. Provide hydration & next-step recommendations.
7. Set see_doctor: "no" / "soon" / "urgent".

Respond ONLY with this JSON — NO markdown, NO code fences:
{
  "image_quality": "good" | "poor",
  "color_category": "pale" | "straw" | "yellow" | "amber" | "orange" | "pink_red" | "brown" | "cloudy" | "other",
  "hydration_status": "over" | "good" | "mild_dehydration" | "dehydrated",
  "possible_indicators": ["..."],
  "red_flags": ["..."],
  "recommendations": ["..."],
  "see_doctor": "no" | "soon" | "urgent",
  "confidence": 0-100,
  "disclaimer": "This is a visual screening only, not a diagnostic test. Consult a doctor for symptoms."
}
If image is unclear or no urine visible, set image_quality="poor" and confidence<30.`,

  urine_dipstick_analysis: `You are a urine dipstick (10-parameter test strip) reader for Indian users. You are NOT a doctor.
Given a photo of a urine reagent test strip (ideally with the bottle's reference color chart visible):
1. Confirm strip detected and readable.
2. For EACH of the 10 standard pads, compare pad color to the reference chart and report:
   - Glucose, Protein, Blood, Leukocytes, Nitrites, Ketones, Bilirubin, Urobilinogen, pH, Specific Gravity
3. Flag any abnormal pad as a red flag (glucose+, protein+, blood+, leukocytes+, nitrites+ are clinically important).
4. Recommend follow-up.

Respond ONLY with this JSON — NO markdown, NO code fences:
{
  "image_quality": "good" | "poor",
  "strip_detected": true | false,
  "pads": [
    { "name": "Glucose", "reading": "Negative" | "Trace" | "+" | "++" | "+++" | "++++" | "<value>", "status": "normal" | "borderline" | "abnormal", "notes": "short note" }
  ],
  "summary": "one-paragraph plain-language summary",
  "red_flags": ["..."],
  "recommendations": ["..."],
  "see_doctor": "no" | "soon" | "urgent",
  "confidence": 0-100,
  "disclaimer": "Dipstick reading by photo can be inaccurate due to lighting and timing. Consult a doctor for confirmed urinalysis."
}
If strip not detected or unreadable, set strip_detected=false, image_quality="poor", and pads=[].`,

  wellness_voice_checkin: `You are a compassionate wellness check-in assistant. Given a transcript of a user's spoken response about how they are feeling, analyze:
1. Overall sentiment (positive, neutral, negative)
2. Mood score (1-10, where 10 is excellent)
3. Signs of confusion, distress, physical weakness, or disorientation
4. Any health concerns mentioned

Respond with a JSON object:
{
  "sentiment": "positive" | "neutral" | "negative",
  "mood_score": 1-10,
  "concerns": ["list of detected concerns, empty if none"],
  "follow_up_needed": true/false,
  "summary": "brief empathetic one-line summary"
}
Only respond with the JSON object, no markdown.`,
};

const taskConfig: Record<string, { model: string; effort?: string }> = {
  symptom_check:     { model: "google/gemini-3.1-pro-preview", effort: "high" },
  vitals_insights:   { model: "google/gemini-3.1-pro-preview", effort: "high" },
  doctor_report:     { model: "google/gemini-3.1-pro-preview", effort: "medium" },
  document_analysis: { model: "google/gemini-3-flash-preview", effort: "medium" },
  medication_info:   { model: "google/gemini-3-flash-preview", effort: "medium" },
  prescription_scan: { model: "google/gemini-3-flash-preview", effort: "medium" },
  banned_check:            { model: "google/gemini-2.5-flash-lite",  effort: "low" },
  face_analysis:           { model: "google/gemini-2.5-flash",       effort: "low" },
  wellness_voice_checkin:  { model: "google/gemini-2.5-flash",       effort: "low" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, payload } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = systemPrompts[type];
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = taskConfig[type] || { model: "google/gemini-3-flash-preview" };
    let model = config.model;
    let messages: any[];

    if (typeof payload === "object" && payload?.image) {
      // Vision mode: always use gemini-2.5-flash for multimodal
      model = "google/gemini-2.5-flash";

      let visionPrompt = "Please read and analyze this image.";
      if (type === "prescription_scan") {
        visionPrompt = "Please read and analyze this prescription image. Extract all medication names, dosages, and details visible in the image.";
      } else if (type === "document_analysis") {
        const category = payload.category || "General";
        visionPrompt = `Category: ${category}\n\nPlease read and analyze this medical document image. Extract all text, values, and findings visible in the image and provide a detailed analysis.`;
      }

      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: visionPrompt },
            { type: "image_url", image_url: { url: payload.image as string } },
          ],
        },
      ];
    } else {
      const MAX_PAYLOAD_CHARS = 20000;
      let userMessage = typeof payload === "string" ? payload : JSON.stringify(payload);
      if (userMessage.length > MAX_PAYLOAD_CHARS) {
        userMessage = userMessage.substring(0, MAX_PAYLOAD_CHARS) + "\n\n[Content truncated due to length]";
        console.log(`Payload truncated to ${MAX_PAYLOAD_CHARS} chars`);
      }
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ];
    }

    const requestBody: any = { model, messages };
    if (config.effort) {
      requestBody.reasoning = { effort: config.effort };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("health-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
