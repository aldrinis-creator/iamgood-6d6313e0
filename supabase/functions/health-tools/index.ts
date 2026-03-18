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
2. Uses and indications
3. Common side effects
4. Drug interactions
5. Dosage guidelines
6. Price range in India (approximate)
7. Whether it requires a prescription
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

  doctor_report: `You are a medical report generator for Indian patients. Given patient health data (vitals, medications, activity, wellness logs), generate a comprehensive doctor visit summary report including:
1. Patient overview
2. Current medications and adherence
3. Vital signs summary and trends
4. Activity and lifestyle summary
5. Wellness and mood trends
6. Key concerns to discuss with doctor
7. Recommended tests or screenings
Format as a professional medical summary in markdown. Use Indian medical standards.`,
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

    const userMessage = typeof payload === "string" ? payload : JSON.stringify(payload);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
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
