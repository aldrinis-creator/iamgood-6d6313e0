// legal-will-partner: returns a partner deep-link URL for Will creation.
// Stub: real partner API key + payload can be plugged in later via secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data } = await supa.auth.getClaims(auth.replace("Bearer ", ""));
    if (!data?.claims) return json({ error: "unauthorized" }, 401);
    const userId = data.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const action = body?.action || "create";
    const partner = body?.partner || "willjini";

    // Deep-link stub. Replace with real partner SDK call later.
    const url = `https://${partner}.com/start?ref=checkin-${userId}&action=${action}`;
    return json({ ok: true, url, partner });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
