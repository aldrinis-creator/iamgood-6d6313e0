import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { classifyAiGatewayFailure } from "../_shared/ai-gateway-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT =
  "You are a medical assistant that extracts medication names from prescriptions. Only return the extracted medication name and standard dosage (e.g., 'Metformin 500mg'). DO NOT return anything else. DO NOT return quantities, schedules, or instructions. If you cannot read it or it is not a prescription, return 'Unknown'.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json({ error: "No image provided" }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json({ error: "AI service is not configured." }, 500);
    }

    // Accept either a raw base64 string or a full data URL.
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the medication name and dosage from this prescription image." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.error("AI gateway error:", response.status, bodyText.slice(0, 500));
      const failure = classifyAiGatewayFailure(response.status, bodyText);
      return json({ error: failure.message, code: failure.code }, failure.status);
    }

    const data = await response.json();
    let drugName: string = data?.choices?.[0]?.message?.content?.trim() || "";

    drugName = drugName.replace(/^["']|["']$/g, "").trim();
    if (/^unknown$/i.test(drugName)) drugName = "";

    return json({ drugName });
  } catch (error) {
    console.error("Error processing prescription:", error);
    return json({ error: "Failed to process image" }, 500);
  }
});
