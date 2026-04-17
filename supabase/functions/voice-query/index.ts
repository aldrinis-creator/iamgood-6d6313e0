import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// IST helpers
const IST_OFFSET_MIN = 330;
const istToday = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return ist.toISOString().slice(0, 10);
};
const istDayBounds = () => {
  const today = istToday();
  // IST midnight = UTC of (today 00:00 IST) → subtract 5h30
  const start = new Date(`${today}T00:00:00+05:30`).toISOString();
  const end = new Date(`${today}T23:59:59.999+05:30`).toISOString();
  return { start, end, today };
};

const tools = [
  { type: "function", function: { name: "get_refills_due", description: "Medications that need refilling (remaining quantity at or below low stock threshold).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_nutrition_metrics", description: "Today's nutrition totals: calories, protein, fiber, sodium, potassium, vs personal goal.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_calorie_progress", description: "Today's calorie progress vs daily calorie goal.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_medications_today", description: "Today's medication doses by status: taken, pending, missed.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_check_in_status", description: "Today's Check-iN status (responded, missed, scheduled).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_health_passport_score", description: "Latest Health Passport scores (overall and per-category).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_appointments_today", description: "Today's appointments.", parameters: { type: "object", properties: {} } } },
];

async function runTool(name: string, supabase: any, userId: string): Promise<any> {
  const { start, end, today } = istDayBounds();
  switch (name) {
    case "get_refills_due": {
      const { data } = await supabase.from("medications").select("name, remaining_quantity, low_stock_threshold").eq("user_id", userId);
      const due = (data ?? []).filter((m: any) => Number(m.remaining_quantity) <= Number(m.low_stock_threshold));
      return { count: due.length, medications: due };
    }
    case "get_nutrition_metrics": {
      const { data: logs } = await supabase.from("meal_logs").select("total_calories,total_protein_g,total_fiber_g,items").eq("user_id", userId).eq("log_date", today);
      const { data: persona } = await supabase.from("nutrition_personas").select("daily_calorie_goal, weight_kg").eq("user_id", userId).maybeSingle();
      let calories = 0, protein = 0, fiber = 0, sodium = 0, potassium = 0;
      (logs ?? []).forEach((l: any) => {
        calories += Number(l.total_calories) || 0;
        protein += Number(l.total_protein_g) || 0;
        fiber += Number(l.total_fiber_g) || 0;
        const items = Array.isArray(l.items) ? l.items : [];
        items.forEach((it: any) => {
          sodium += Number(it?.sodium_mg) || 0;
          potassium += Number(it?.potassium_mg) || 0;
        });
      });
      return { calories: Math.round(calories), protein_g: Math.round(protein), fiber_g: Math.round(fiber), sodium_mg: Math.round(sodium), potassium_mg: Math.round(potassium), daily_calorie_goal: persona?.daily_calorie_goal ?? null };
    }
    case "get_calorie_progress": {
      const { data: logs } = await supabase.from("meal_logs").select("total_calories").eq("user_id", userId).eq("log_date", today);
      const { data: persona } = await supabase.from("nutrition_personas").select("daily_calorie_goal").eq("user_id", userId).maybeSingle();
      const consumed = Math.round((logs ?? []).reduce((s: number, l: any) => s + (Number(l.total_calories) || 0), 0));
      const goal = persona?.daily_calorie_goal ?? null;
      const pct = goal ? Math.round((consumed / goal) * 100) : null;
      return { consumed, goal, percent: pct, remaining: goal ? Math.max(0, goal - consumed) : null };
    }
    case "get_medications_today": {
      const { data } = await supabase.from("medication_logs").select("status, scheduled_at, medications(name)").eq("user_id", userId).gte("scheduled_at", start).lte("scheduled_at", end);
      const rows = data ?? [];
      const taken = rows.filter((r: any) => r.status === "taken").length;
      const missed = rows.filter((r: any) => r.status === "missed").length;
      const pending = rows.filter((r: any) => r.status === "pending" || r.status === "scheduled").length;
      return { total: rows.length, taken, missed, pending };
    }
    case "get_check_in_status": {
      const { data } = await supabase.from("check_ins").select("status, scheduled_at, response").eq("user_id", userId).gte("scheduled_at", start).lte("scheduled_at", end);
      return { total: (data ?? []).length, items: data ?? [] };
    }
    case "get_health_passport_score": {
      const { data } = await supabase.from("health_passport_scores").select("*").eq("user_id", userId).order("score_date", { ascending: false }).limit(1).maybeSingle();
      return data ?? { message: "No score yet" };
    }
    case "get_appointments_today": {
      const { data } = await supabase.from("appointments").select("title, start_time, doctor_name, location").eq("user_id", userId).eq("start_date", today).order("start_time");
      return { count: (data ?? []).length, appointments: data ?? [] };
    }
    default:
      return { error: "Unknown tool" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Missing query" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are Check-iN's voice assistant. The user just spoke a question. Pick the most relevant tool to answer it. After receiving tool results, respond in 1-2 short, natural sentences suitable for being spoken aloud. Use IST. Be concrete with numbers. If no relevant data, say so kindly.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ];

    // First call — let model pick a tool
    const firstResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, tools, tool_choice: "auto" }),
    });
    if (firstResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit, please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (firstResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!firstResp.ok) {
      const t = await firstResp.text();
      console.error("AI first call failed:", firstResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const firstData = await firstResp.json();
    const choice = firstData.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls ?? [];

    if (!toolCalls.length) {
      const answer = choice?.content ?? "I'm not sure how to answer that yet.";
      return new Response(JSON.stringify({ answer, tool: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Execute first tool call
    const call = toolCalls[0];
    const toolName = call.function?.name;
    const toolResult = await runTool(toolName, supabase, user.id);

    // Second call — compose spoken answer
    const messages2: any[] = [
      ...messages,
      { role: "assistant", content: choice.content ?? null, tool_calls: toolCalls },
      { role: "tool", tool_call_id: call.id, content: JSON.stringify(toolResult) },
    ];
    const secondResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: messages2 }),
    });
    if (!secondResp.ok) {
      const t = await secondResp.text();
      console.error("AI second call failed:", secondResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const secondData = await secondResp.json();
    const answer = secondData.choices?.[0]?.message?.content ?? "I couldn't generate a response.";

    return new Response(JSON.stringify({ answer, tool: toolName, data: toolResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("voice-query error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
