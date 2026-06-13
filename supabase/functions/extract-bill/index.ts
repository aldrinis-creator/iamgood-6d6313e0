import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a strict bill/receipt parser for healthcare expenses.
Given an image of a bill, invoice, prescription receipt, or insurance premium notice, return ONLY a JSON object with this exact shape:
{
  "amount": number,                     // total amount paid (numeric only, no symbols)
  "currency": string,                   // ISO code like "INR", "USD". Default "INR" if unclear.
  "merchant": string,                   // shop / hospital / pharmacy / insurer name, "" if unknown
  "date": string,                       // expense date in YYYY-MM-DD; "" if unknown
  "category": string                    // one of: medication, doctor_fees, insurance, diagnostics, equipment_caregiving, other
}
Rules:
- Respond with JSON only. No markdown, no code fences, no commentary.
- If the bill is from a pharmacy/chemist or lists medicines, category = "medication".
- Doctor consultation / clinic visit / OPD => "doctor_fees".
- Lab / scan / x-ray / MRI / pathology => "diagnostics".
- Insurance premium / policy receipt => "insurance".
- Wheelchair, oxygen, hearing aid, home-care, attendant => "equipment_caregiving".
- Anything else healthcare-related => "other".
- If you cannot read the bill at all, return {"amount":0,"currency":"INR","merchant":"","date":"","category":"other"}.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const imagePath: string | undefined = body?.imagePath;
    if (!imagePath || typeof imagePath !== "string") {
      return new Response(JSON.stringify({ error: "imagePath required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // imagePath must live under the caller's user folder
    if (!imagePath.startsWith(`${ures.user.id}/`)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: signed, error: signErr } = await service.storage
      .from("healthcare-bills")
      .createSignedUrl(imagePath, 120);
    if (signErr || !signed?.signedUrl) {
      console.error("sign error", signErr);
      return new Response(JSON.stringify({ error: "Cannot read bill" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract this healthcare bill into the JSON schema." },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      const t = await aiResp.text();
      console.error("AI error", status, t);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }

    return new Response(JSON.stringify({ extracted: parsed, raw }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-bill error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
