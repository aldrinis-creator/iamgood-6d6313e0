import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PRODUCT_KB } from "../_shared/product-kb.ts";

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
const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY");

const MODEL = "google/gemini-2.5-flash";
// Sarvam TTS — Indian voices. bulbul:v2 speakers: anushka, manisha, vidya, arya (female), abhilash, karun, hitesh (male).
const SARVAM_SPEAKER = "anushka";
const SARVAM_MODEL = "bulbul:v2";
const SARVAM_LANG = "en-IN";
const SARVAM_MAX_CHARS = 1500; // per-input cap for bulbul:v2

// Split text into chunks under Sarvam's per-input character cap, preferring sentence boundaries.
function chunkForSarvam(text: string, maxChars = SARVAM_MAX_CHARS): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (s.length > maxChars) {
      if (current) { chunks.push(current); current = ""; }
      for (let i = 0; i < s.length; i += maxChars) chunks.push(s.slice(i, i + maxChars));
      continue;
    }
    if (current.length + s.length > maxChars) { chunks.push(current); current = ""; }
    current += s;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function synthesizeSpeech(text: string): Promise<string | null> {
  if (!SARVAM_API_KEY || !text) return null;
  try {
    const inputs = chunkForSarvam(text);
    const resp = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs,
        target_language_code: SARVAM_LANG,
        speaker: SARVAM_SPEAKER,
        model: SARVAM_MODEL,
        enable_preprocessing: true,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error("[voice-query] Sarvam TTS failed:", resp.status, err.slice(0, 300));
      return null;
    }
    const data = await resp.json();
    const audios: string[] = Array.isArray(data?.audios) ? data.audios : [];
    if (audios.length === 0) {
      console.error("[voice-query] Sarvam TTS returned no audios");
      return null;
    }
    // Sarvam returns base64-encoded WAV per input; return the first (typically the only) chunk.
    // Concatenating raw WAV base64 chunks would corrupt the header, so we send them one at a time.
    return `data:audio/wav;base64,${audios[0]}`;
  } catch (e) {
    console.error("[voice-query] TTS exception:", e);
    return null;
  }
}

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
    supabase.from("medications").select("id, name, dosage, schedule_times, start_date, end_date, remaining_quantity, low_stock_threshold").eq("user_id", userId).lte("start_date", today),
    supabase.from("meal_logs").select("total_calories,total_protein_g,total_fiber_g,items").eq("user_id", userId).eq("log_date", today),
    supabase.from("nutrition_personas").select("daily_calorie_goal").eq("user_id", userId).maybeSingle(),
    supabase.from("medication_logs").select("medication_id, status, scheduled_at").eq("user_id", userId).gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("check_ins").select("status, scheduled_at, response").eq("user_id", userId).gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("health_passport_scores").select("overall, vitals, nutrition, medications, activity, wellness, checkin, score_date").eq("user_id", userId).order("score_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("appointments").select("title, start_time, doctor_name, location").eq("user_id", userId).eq("start_date", today).order("start_time"),
  ]);

  const activeMeds = (meds.data ?? []).filter((m: any) => !m.end_date || m.end_date >= today);

  // Refills
  const refillsDue = activeMeds
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

  // Build per-slot dose list for today from medications.schedule_times, then
  // match to medication_logs. Anything without a log and past 60m grace = missed;
  // past scheduled but within grace = pending/overdue; future = upcoming.
  const nowIst = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
  const nowMin = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
  const logs = medLogs.data ?? [];
  type Slot = { name: string; dosage: string; time: string; status: "taken" | "taken_late" | "missed" | "pending" | "upcoming" };
  const slots: Slot[] = [];
  for (const m of activeMeds) {
    const times: string[] = Array.isArray(m.schedule_times) ? m.schedule_times : [];
    for (const t of times) {
      const [hStr, mStr] = String(t).split(":");
      const h = parseInt(hStr, 10);
      const mm = parseInt(mStr || "0", 10);
      if (Number.isNaN(h)) continue;
      const slotMin = h * 60 + mm;
      const log = logs.find((l: any) => {
        if (l.medication_id !== m.id) return false;
        const d = new Date(new Date(l.scheduled_at).getTime() + IST_OFFSET_MIN * 60_000);
        return d.getUTCHours() === h && d.getUTCMinutes() === mm;
      });
      let status: Slot["status"];
      if (log?.status === "taken") status = "taken";
      else if (log?.status === "taken_late") status = "taken_late";
      else if (log?.status === "missed" || log?.status === "skipped") status = "missed";
      else if (slotMin > nowMin) status = "upcoming";
      else if (nowMin - slotMin > 60) status = "missed";
      else status = "pending";
      slots.push({ name: m.name, dosage: m.dosage ?? "", time: t, status });
    }
  }

  const taken = slots.filter(s => s.status === "taken" || s.status === "taken_late").length;
  const missed = slots.filter(s => s.status === "missed").length;
  const overdue = slots.filter(s => s.status === "pending").map(s => ({ name: s.name, dosage: s.dosage, time: s.time }));
  const upcoming = slots.filter(s => s.status === "upcoming").map(s => ({ name: s.name, dosage: s.dosage, time: s.time }));

  // Check-ins
  const checkInRows = checkIns.data ?? [];
  const checkInsResponded = checkInRows.filter((c: any) => c.status === "responded").length;
  const checkInsMissed = checkInRows.filter((c: any) => c.status === "missed").length;

  return {
    today_ist: today,
    now_ist_time: `${String(nowIst.getUTCHours()).padStart(2, "0")}:${String(nowIst.getUTCMinutes()).padStart(2, "0")}`,
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
    medications_today: {
      total: slots.length,
      taken,
      missed,
      pending: overdue.length + upcoming.length,
      overdue,
      upcoming,
    },
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

    const systemPrompt = `You are Check-iN's friendly voice assistant for an Indian elder-care app. The user spoke a question aloud. You know two things: (1) a JSON snapshot of their PERSONAL health data for today (IST: ${context.today_ist}) covering medication refills, nutrition totals, medication doses (taken/missed/pending), check-ins, latest health passport score, and today's appointments; and (2) a PRODUCT knowledge base describing how the Check-iN app works.

Rules:
- Answer in 1-2 short, natural sentences suitable to be spoken aloud. Be warm and concrete with numbers.
- If the question is about how the APP works (features, plans, guardian nomination, vault, SOS, ambulance booking, registration, refills, etc.), answer from the PRODUCT KNOWLEDGE BASE below. If the knowledge base describes a feature that answers the question, you MUST use it — do NOT fall back to "the app doesn't do that", "use your phone's emergency services", or "call the local emergency number" when the feature exists in the app. Example — Q: "How do I book an ambulance?" A: "Open Services and tap Ambulance, pick a provider and confirm — guardians can also book on behalf of their ward."
- If the question is about their PERSONAL health data and it's in the snapshot, answer directly.
- For medication questions ("any meds due", "what's pending", "did I take everything"), read \`medications_today\` carefully. \`overdue\` = past their time but still within grace, \`upcoming\` = later today, \`taken\`/\`missed\` are counts. If \`overdue\` or \`upcoming\` has items, name them (e.g. "Yes, Metformin 500mg is due at 8pm."). Only say "all taken" when \`total > 0\` AND both \`overdue\` and \`upcoming\` are empty. If \`total == 0\`, say no medications are scheduled today. Never claim all taken just because \`taken == 0\`.
- If the question is about their personal data but not in the snapshot (e.g. "what's my blood pressure trend?"), say kindly you don't have that handy and suggest where to look in the app (e.g. "Check the Vitals Monitor on My Health").
- For general health/wellness advice (e.g. "is paracetamol safe with my BP meds?"), give a brief safe answer and recommend consulting their doctor.
- For completely off-topic questions (weather, sports, jokes, math), politely redirect: "I'm your Check-iN assistant — I can help with your health data or explain how the app works. What would you like to know?"
- Never say "the data", "the JSON", "the snapshot", or "the knowledge base" — speak naturally as if you just know.
- Never invent numbers, features, or facts, and never invent prices.

PRODUCT KNOWLEDGE BASE:
${PRODUCT_KB}`;


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
    if (aiResp.status === 402) {
      // Return 200 with a friendly spoken answer so the UI degrades gracefully
      // instead of throwing on the client. Audio is null → browser TTS fallback.
      const msg = "The voice assistant is temporarily out of credits. Please ask your administrator to top up the AI balance.";
      return json({ answer: msg, audio: null, degraded: "credits_exhausted" }, 200);
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[voice-query] AI gateway error:", aiResp.status, t.slice(0, 500));
      return json({ error: "Voice assistant is temporarily unavailable. Please try again shortly." }, 502);
    }

    const aiData = await aiResp.json();
    const answer = aiData.choices?.[0]?.message?.content?.trim() ||
      "I couldn't phrase a response. Please try rephrasing your question.";
    console.log(`[voice-query] answer="${answer.slice(0, 120)}"`);

    const audio = await synthesizeSpeech(answer);
    console.log(`[voice-query] tts=${audio ? "ok" : "skipped"}`);

    return json({ answer, audio });
  } catch (e) {
    console.error("[voice-query] uncaught error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
