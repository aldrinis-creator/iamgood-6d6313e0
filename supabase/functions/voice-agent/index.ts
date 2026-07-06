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
const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY") || "sk_yl2d4msc_LouCY7vzRj0DS5xMkrez8iwQ";

const MODEL = "google/gemini-2.5-flash";
const TTS_SPEAKER = "aditya"; // Sarvam speaker
const TTS_TARGET_LANGUAGE = "en-IN"; // Indian English

const MAX_TURNS_PER_DAY = 50;
const dailyTurns = new Map<string, { count: number; date: string }>();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

async function synthesizeSpeech(text: string): Promise<string | null> {
  if (!SARVAM_API_KEY || !text) return null;
  try {
    const resp = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [text.slice(0, 500)], // Sometimes inputs array is used
        target_language_code: TTS_TARGET_LANGUAGE,
        speaker: TTS_SPEAKER,
      }),
    });

    if (!resp.ok) {
      // Try fallback format if it fails (the API has had two formats: 'inputs' array vs 'text' string)
      const resp2 = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          target_language_code: TTS_TARGET_LANGUAGE,
          speaker: TTS_SPEAKER,
          model: "bulbul:v3"
        }),
      });

      if (!resp2.ok) {
        console.error("[voice-agent] Sarvam TTS failed:", resp2.status, await resp2.text());
        return null;
      }
      const data = await resp2.json();
      if (data.audios && data.audios.length > 0) {
        return `data:audio/wav;base64,${data.audios[0]}`;
      }
      return null;
    }

    const data = await resp.json();
    if (data.audios && data.audios.length > 0) {
      return `data:audio/wav;base64,${data.audios[0]}`;
    }
    return null;
  } catch (e) {
    console.error("[voice-agent] TTS exception:", e);
    return null;
  }
}

const IST_OFFSET_MIN = 330;
const istToday = () => new Date(Date.now() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
const istDayBounds = () => {
  const today = istToday();
  return {
    start: new Date(`${today}T00:00:00+05:30`).toISOString(),
    end: new Date(`${today}T23:59:59.999+05:30`).toISOString(),
    today,
  };
};

async function gatherUserContext(supabase: any, userId: string) {
  const { start, end, today } = istDayBounds();
  const [meds, mealLogs, persona, medLogs, checkIns, score, appts] = await Promise.all([
    supabase.from("medications").select("name, remaining_quantity, low_stock_threshold").eq("user_id", userId),
    supabase.from("meal_logs").select("total_calories,total_protein_g,total_fiber_g").eq("user_id", userId).eq("log_date", today),
    supabase.from("nutrition_personas").select("daily_calorie_goal").eq("user_id", userId).maybeSingle(),
    supabase.from("medication_logs").select("status").eq("user_id", userId).gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("check_ins").select("status, scheduled_at").eq("user_id", userId).gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("health_passport_scores").select("overall, score_date").eq("user_id", userId).order("score_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("appointments").select("title, start_time, doctor_name").eq("user_id", userId).eq("start_date", today).order("start_time"),
  ]);

  const refillsDue = (meds.data ?? []).filter((m: any) => Number(m.remaining_quantity) <= Number(m.low_stock_threshold));
  let calories = 0;
  (mealLogs.data ?? []).forEach((l: any) => { calories += Number(l.total_calories) || 0; });
  const medRows = medLogs.data ?? [];
  const checkInRows = checkIns.data ?? [];

  return {
    today_ist: today,
    refills_due: refillsDue.map((m: any) => m.name),
    nutrition_today: {
      calories: Math.round(calories),
      goal: persona.data?.daily_calorie_goal ?? null,
    },
    medications_today: {
      taken: medRows.filter((r: any) => r.status === "taken").length,
      missed: medRows.filter((r: any) => r.status === "missed").length,
      pending: medRows.filter((r: any) => r.status === "pending" || r.status === "scheduled").length,
    },
    check_ins_today: {
      responded: checkInRows.filter((c: any) => c.status === "responded").length,
      missed: checkInRows.filter((c: any) => c.status === "missed").length,
    },
    health_passport_score: score.data?.overall ?? null,
    appointments_today: appts.data ?? [],
  };
}

async function gatherGuardianContext(supabase: any, guardianUserId: string, wardUserId: string | null) {
  if (!wardUserId) return { ward: null };
  const { start, end, today } = istDayBounds();
  const [ward, medLogs, checkIns, score, appts, safeZones] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", wardUserId).maybeSingle(),
    supabase.from("medication_logs").select("status").eq("user_id", wardUserId).gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("check_ins").select("status, scheduled_at").eq("user_id", wardUserId).gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("health_passport_scores").select("overall").eq("user_id", wardUserId).order("score_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("appointments").select("title, start_time").eq("user_id", wardUserId).eq("start_date", today),
    supabase.from("safe_zones").select("name").eq("user_id", wardUserId),
  ]);
  const medRows = medLogs.data ?? [];
  const ciRows = checkIns.data ?? [];
  return {
    today_ist: today,
    ward_name: ward.data?.full_name ?? "your ward",
    medications_today: {
      taken: medRows.filter((r: any) => r.status === "taken").length,
      missed: medRows.filter((r: any) => r.status === "missed").length,
      pending: medRows.filter((r: any) => r.status === "pending" || r.status === "scheduled").length,
    },
    check_ins_today: {
      responded: ciRows.filter((c: any) => c.status === "responded").length,
      missed: ciRows.filter((c: any) => c.status === "missed").length,
    },
    health_passport_score: score.data?.overall ?? null,
    appointments_today: appts.data ?? [],
    safe_zones: (safeZones.data ?? []).map((z: any) => z.name),
  };
}

function systemPrompt(persona: "user" | "guardian", mode: "health" | "companion", context: any): string {
  const ctxJson = JSON.stringify(context);

  if (mode === "companion") {
    return `You are a warm, gentle voice companion for an Indian elder-care app called Check-iN. The person speaking is ${persona === "guardian" ? "a Guardian caring for a loved one" : "an elder user"}.

Your role: be a kind friend. Make small talk, listen, offer encouragement, suggest light mindfulness (deep breathing, gratitude), share a gentle reminder if relevant to their day. Use short, warm, conversational replies (1-3 sentences) suitable for spoken aloud.

Rules:
- Never give medical diagnoses or prescribe treatments. If they describe symptoms, suggest they consult their doctor.
- Never mention "the data", "JSON", or "context" — speak naturally.
- If they sound sad/lonely, acknowledge feelings kindly before responding.
- Their snapshot today (for awareness only — don't quote numbers unless asked): ${ctxJson}`;
  }

  if (persona === "guardian") {
    return `You are Check-iN's voice assistant speaking with a Guardian about their ward. Use the ward summary snapshot below to answer questions about medications, check-ins, appointments, and health score. Be warm, concise (1-2 sentences), and natural — suitable to be heard aloud.

Rules:
- If asked about something not in the snapshot (live location, vitals trend), kindly say you don't have that handy and point them to the Guardian Dashboard.
- For general advice, give brief safe guidance and suggest consulting the ward's doctor.
- Never say "the snapshot" or "the data".
- Ward snapshot: ${ctxJson}`;
  }

  return `You are Check-iN's friendly voice health assistant for an Indian elder-care app. Answer the user's questions using the health snapshot below. Be warm, concise (1-2 sentences), natural for spoken delivery.

Rules:
- If the answer is in the snapshot, answer directly with concrete numbers.
- If not in snapshot, kindly say so and point to the relevant app screen.
- General health questions: give brief safe advice, suggest consulting their doctor for specifics.
- Off-topic: politely redirect to health/app topics.
- Never say "the snapshot", "the data", or "the JSON".
- Snapshot: ${ctxJson}`;
}

function checkAndIncrementQuota(userId: string): boolean {
  const today = istToday();
  const rec = dailyTurns.get(userId);
  if (!rec || rec.date !== today) {
    dailyTurns.set(userId, { count: 1, date: today });
    return true;
  }
  if (rec.count >= MAX_TURNS_PER_DAY) return false;
  rec.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Please sign in to use the voice assistant." }, 401);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }
    const userId = userData.user.id;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }

    const messages = Array.isArray(body?.messages) ? body.messages.slice(-10) : [];
    if (messages.length === 0) return json({ error: "Please say something." }, 400);
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (!lastUserMsg?.content) return json({ error: "Please say something." }, 400);

    const mode: "health" | "companion" = body.mode === "companion" ? "companion" : "health";
    const persona: "user" | "guardian" = body.persona === "guardian" ? "guardian" : "user";
    const wardUserId: string | null = typeof body.wardUserId === "string" ? body.wardUserId : null;

    if (!checkAndIncrementQuota(userId)) {
      return json({
        answer: "You've reached today's chat limit of 50 turns. Let's continue tomorrow!",
        audio: null,
        degraded: "quota_exceeded",
      });
    }

    const context = persona === "guardian"
      ? await gatherGuardianContext(supabase, userId, wardUserId)
      : await gatherUserContext(supabase, userId);

    const sys = systemPrompt(persona, mode, context);
    const chatMessages = [
      { role: "system", content: sys },
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, 2000),
      })),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: chatMessages }),
    });

    if (aiResp.status === 429) return json({ error: "Voice assistant is busy. Please try again in a moment." }, 429);
    if (aiResp.status === 402) {
      return json({ answer: "The voice assistant is temporarily out of credits. Please ask the admin to top up.", audio: null, degraded: "credits_exhausted" });
    }
    if (!aiResp.ok) {
      console.error("[voice-agent] AI gateway error:", aiResp.status, (await aiResp.text()).slice(0, 300));
      return json({ error: "Voice assistant is temporarily unavailable. Please try again shortly." }, 502);
    }

    const aiData = await aiResp.json();
    const answer = aiData.choices?.[0]?.message?.content?.trim() || "I couldn't phrase a response. Please try rephrasing.";
    const audio = await synthesizeSpeech(answer);

    return json({ answer, audio });
  } catch (e) {
    console.error("[voice-agent] uncaught error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
