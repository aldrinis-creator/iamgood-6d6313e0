import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(
        JSON.stringify({
          error: "OpenAI API key not configured. Please add OPENAI_API_KEY to your Supabase Edge Function secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a medical assistant that extracts medication names from prescriptions. Only return the extracted medication name and standard dosage (e.g., 'Metformin 500mg'). DO NOT return anything else. DO NOT return quantities, schedules, or instructions. If you cannot read it or it is not a prescription, return 'Unknown'.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: "data:image/jpeg;base64," + imageBase64,
              },
            },
          ],
        },
      ],
      max_tokens: 100,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + openAiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI error:", err);
      return new Response(JSON.stringify({ error: "Failed to process image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let drugName = data.choices[0]?.message?.content?.trim() || "";

    // Clean up if model added quotes or formatting
    drugName = drugName.replace(/^["']|["']$/g, "");
    if (drugName === "Unknown") drugName = "";

    return new Response(JSON.stringify({ drugName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing prescription:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
