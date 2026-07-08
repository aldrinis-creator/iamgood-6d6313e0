import { PRODUCT_KB } from "../_shared/product-kb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-2.5-flash-lite";

// Very light in-memory IP rate limit — 20 requests / minute per IP.
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.reset) {
    buckets.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  b.count++;
  return b.count > 20;
}

const SYSTEM_PROMPT = `You are the Check-iN product help assistant. Answer questions about the Check-iN app — features, how to use them, registration, guardian nomination, vault, medications, subscriptions, SOS, privacy, etc. — using ONLY the knowledge base below.

Rules:
- Keep answers short (1–3 sentences) and plain-language, suitable for elderly users.
- If the question isn't covered by the knowledge base, say so honestly and point them to the in-app Help page or Contact Us.
- If the question is about the user's PERSONAL data ("what's my blood pressure?", "did I take my medicine?", "how many calories today?"), reply: "That's personal to your account — please sign in and tap the microphone button to ask the voice assistant."
- If the question is completely off-topic (weather, jokes, sports), politely redirect: "I'm the Check-iN help assistant — I can explain features, plans, and how the app works. What would you like to know?"
- Never invent features, prices, or steps that aren't in the knowledge base.
- Use markdown sparingly (bold for key terms, short bullet lists only when it genuinely helps).

Knowledge base:
${PRODUCT_KB}`;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (rateLimited(ip)) {
      return json({ error: "You're asking a lot right now — please wait a moment and try again." }, 429);
    }

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }

    // Accept either { messages: [...] } (AI SDK UI message format is converted below)
    // or a simple { query: "..." }.
    let messages: ChatMessage[] = [];
    if (Array.isArray(body?.messages)) {
      messages = body.messages
        .map((m: any) => {
          if (typeof m?.content === "string") return { role: m.role, content: m.content };
          if (Array.isArray(m?.parts)) {
            const text = m.parts.filter((p: any) => p?.type === "text").map((p: any) => p.text).join("");
            return { role: m.role, content: text };
          }
          return null;
        })
        .filter((m: any): m is ChatMessage => m && typeof m.content === "string" && m.content.length > 0);
    } else if (typeof body?.query === "string" && body.query.trim()) {
      messages = [{ role: "user", content: body.query.trim() }];
    }
    if (messages.length === 0) return json({ error: "Please ask a question." }, 400);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (aiResp.status === 429) return json({ error: "The assistant is busy — please try again in a moment." }, 429);
    if (aiResp.status === 402) return json({ answer: "The help assistant is temporarily out of credits. Please try again later.", degraded: "credits_exhausted" }, 200);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[product-assistant] gateway error:", aiResp.status, t.slice(0, 500));
      return json({ error: "Help assistant is temporarily unavailable." }, 502);
    }

    const data = await aiResp.json();
    const answer = data.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn't find that in the help guide. Please try rephrasing, or open Help in the app.";

    return json({ answer });
  } catch (e) {
    console.error("[product-assistant] uncaught:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
