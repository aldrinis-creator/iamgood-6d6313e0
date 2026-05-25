import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BodySchema = z.object({
  email: z.string().trim().email().max(255).transform((s) => s.toLowerCase()),
  full_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  source: z.string().trim().max(60).optional(),
});

// In-memory rate limit: 5 req / IP / minute
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  ipHits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    if (rateLimited(ip)) return json({ error: "Too many requests" }, 429);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { email, full_name, phone, source } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check existing
    const { data: existing, error: selErr } = await supabase
      .from("premium_plus_waitlist")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing) {
      return json({ ok: true, alreadyJoined: true });
    }

    const { error: insErr } = await supabase
      .from("premium_plus_waitlist")
      .insert({
        email,
        full_name: full_name || null,
        phone: phone || null,
        source: source || "web-landing-page",
      });

    if (insErr) {
      // Unique conflict race
      if ((insErr as { code?: string }).code === "23505") {
        return json({ ok: true, alreadyJoined: true });
      }
      throw insErr;
    }

    // Fire-and-forget confirmation email
    supabase.functions
      .invoke("send-transactional-email", {
        body: {
          templateName: "premium-plus-waitlist-confirmation",
          recipientEmail: email,
          idempotencyKey: `pp-waitlist-${email}`,
          templateData: { name: full_name || undefined },
        },
      })
      .catch((e) => console.error("confirmation email failed", e));

    return json({ ok: true, alreadyJoined: false });
  } catch (err) {
    console.error("join-waitlist error", err);
    return json({ error: (err as Error).message || "Server error" }, 500);
  }
});
