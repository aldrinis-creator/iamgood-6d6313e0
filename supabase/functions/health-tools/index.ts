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

  document_analysis: `You are a medical document analysis assistant. Given the text content of a medical document, provide:
1. Document type identification
2. Key findings summary in plain language
3. Important values and whether they are normal/abnormal
4. Recommended follow-up actions
5. Questions to ask your doctor
Use simple language a non-medical person can understand. Format with markdown.`,

  vitals_insights: `You are a health analytics assistant for Indian users. Given aggregated vitals data (heart rate readings, SpO2, stress scores, activity logs, wellness logs), provide:
1. Overall health summary
2. Anomaly detection — flag any unusual patterns (e.g. consistently elevated HR, low SpO2, high stress)
3. Trend analysis — improving, stable, or declining health indicators
4. Actionable recommendations (exercise, sleep, stress management)
5. When to consult a doctor (reference Indian healthcare: government hospitals, AIIMS, local clinics)
Note: Face scan PPG data may be inaccurate — flag this in your analysis if values seem inconsistent.
Always include a disclaimer that this is not medical advice. Format with markdown.`,

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
