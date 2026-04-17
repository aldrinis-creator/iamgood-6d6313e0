import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MODEL = "google/gemini-2.5-flash";

const IST_OFFSET_MIN = 330;
const istToday = () => {
  const ist = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
  return ist.toISOString().slice(0, 10);
};
const istDayBounds = () => {
  const today = istToday();
  return {
    start: new Date(`${today}T00:00:00+05:30`).toISOString(),
    end: new Date(`${today}T23:59:59.999+05:30`).toISOString(),
    today,
  };
};

// Pre-fetch all relevant context in parallel — simpler & more reliable than tool-calling.
async function gatherContext(supabase: any, userId: string) {
  const { start, end, today } = istDayBounds();

  const [meds, mealLogs, persona, medLogs, checkIns, score, appts] = await Promise.all([
    supabase.from("medications").select("name, remaining_quantity, low_stock_threshold").eq("user_id", userId),
    supabase.from("meal_logs").select("total_calories,total_protein_g,total_fiber_g,items").eq("user_id", userId).eq("log_date", today),
    supabase.from("nutrition_personas").select("daily_calorie_goal").eq("user_id", userId).maybeSingle(),
    supabase.from("medication_logs").select("status, medications(name)").eq("user_id", userId).gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("check_ins").select("status, scheduled_at, response").eq("user_id", userId).gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("health_passport_scores").select("overall, vitals, nutrition, medications, activity, wellness, checkin, score_date").eq("user_id", userId).order("score_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("appointments").select("title, start_time, doctor_name, location").eq("user_id", userId).eq("start_date", today).order("start_time"),
  ]);

  // Refills
  const refillsDue = (meds.data ?? [])
    .filter((m: any) => Number(m.remaining_quantity) <= Number(m.low_stock_threshold))
    .map((m: any) => ({ name: m.name, remaining: m.remaining_quantity }));

  // Nutrition totals
  let calories = 0, protein = 0, fiber = 0, sodium = 0, potassium = 0;
  (mealLogs.data ?? []).forEach((l: any) => {
    calories += Number(l.total_calories) || 0;
    protein += Number(l.total_protein_g) || 0;
    fiber += Number(l.total_fiber_g) || 0;
    (Array.isArray(l.items) ? l.items : []).forEach((it: any) => {
      sodium += Number(it?.sodium_mg) || 0;
      potassium += Number(it?.potassium_mg) || 0;
    });
  });
  const calorieGoal = persona.data?.daily_calorie_goal ?? null;

  // Medication status
  const medRows = medLogs.data ?? [];
  const medsTaken = medRows.filter((r: any) => r.status === "taken").length;
  const medsMissed = medRows.filter((r: any) => r.status === "missed").length;
  const medsPending = medRows.filter((r: any) => r.status === "pending" || r.status === "scheduled").length;

  // Check-ins
  const checkInRows = checkIns.data ?? [];
  const checkInsResponded = checkInRows.filter((c: any) => c.status === "responded").length;
  const checkInsMissed = checkInRows.filter((c: any) => c.status === "missed").length;

  return {
    today_ist: today,
    refills_due: { count: refillsDue.length, items: refillsDue },
    nutrition_today: {
      calories: Math.round(calories),
      protein_g: Math.round(protein),
      fiber_g: Math.round(fiber),
      sodium_mg: Math.round(sodium),
      potassium_mg: Math.round(potassium),
      daily_calorie_goal: calorieGoal,
      calorie_percent: calorieGoal ? Math.round((calories / calorieGoal) * 100) : null,
      calorie_remaining: calorieGoal ? Math.max(0, calorieGoal - Math.round(calories)) : null,
    },
    medications_today: { total: medRows.length, taken: medsTaken, missed: medsMissed, pending: medsPending },
    check_ins_today: { total: checkInRows.length, responded: checkInsResponded, missed: checkInsMissed },
    health_passport: score.data ?? null,
    appointments_today: { count: (appts.data ?? []).length, items: appts.data ?? [] },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[voice-query] missing Authorization header");
      return json({ error: "Please sign in to use the voice assistant." }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) {
      console.error("[voice-query] invalid JWT:", userErr?.message);
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }
    const userId = userData.user.id;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) return json({ error: "Please say something to ask." }, 400);

    console.log(`[voice-query] user=${userId} query="${query}"`);

    const context = await gatherContext(supabase, userId);
    console.log(`[voice-query] context keys: ${Object.keys(context).join(",")}`);

    const systemPrompt = `You are Check-iN's voice assistant. The user spoke a question. You're given a JSON snapshot of their data for today (IST: ${context.today_ist}). Answer in 1-2 short, natural sentences suitable for being spoken aloud. Be concrete with numbers. If the answer isn't in the data, say so kindly. Never mention "the data" or "JSON" — speak naturally.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Question: ${query}\n\nMy data:\n${JSON.stringify(context)}` },
        ],
      }),
    });

    if (aiResp.status === 429) return json({ error: "Voice assistant is busy. Please try again in a moment." }, 429);
    if (aiResp.status === 402) return json({ error: "Voice assistant credits exhausted. Please contact support." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[voice-query] AI gateway error:", aiResp.status, t.slice(0, 500));
      return json({ error: "Voice assistant is temporarily unavailable. Please try again shortly." }, 502);
    }

    const aiData = await aiResp.json();
    const answer = aiData.choices?.[0]?.message?.content?.trim() ||
      "I couldn't phrase a response. Please try rephrasing your question.";
    console.log(`[voice-query] answer="${answer.slice(0, 120)}"`);

    return json({ answer });
  } catch (e) {
    console.error("[voice-query] uncaught error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
