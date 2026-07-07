import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!SARVAM_API_KEY) {
      return new Response(JSON.stringify({ error: "SARVAM_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ct = req.headers.get("Content-Type") || "";
    if (!ct.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const audio = form.get("audio");
    const language = (form.get("language") as string) || "unknown";

    if (!(audio instanceof File) && !(audio instanceof Blob)) {
      return new Response(JSON.stringify({ error: "audio file required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBlob = audio as Blob;
    if (audioBlob.size < 2048) {
      return new Response(JSON.stringify({ error: "Audio too short — please try again." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive filename with extension from mime
    const mime = audioBlob.type || "audio/webm";
    const ext =
      mime.includes("mp4") ? "mp4" :
      mime.includes("wav") ? "wav" :
      mime.includes("mpeg") ? "mp3" :
      mime.includes("ogg") ? "ogg" :
      "webm";
    const filename = (audio as File).name || `recording.${ext}`;

    const upstream = new FormData();
    upstream.append("file", audioBlob, filename);
    upstream.append("model", "saarika:v2");
    upstream.append("language_code", language);

    const resp = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": SARVAM_API_KEY },
      body: upstream,
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("Sarvam STT error", resp.status, text);
      return new Response(JSON.stringify({ error: `Sarvam STT ${resp.status}: ${text.slice(0, 300)}` }), {
        status: resp.status === 402 || resp.status === 429 ? resp.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: any = {};
    try { data = JSON.parse(text); } catch { /* keep empty */ }
    const transcript = (data?.transcript ?? "").toString().trim();

    return new Response(
      JSON.stringify({ transcript, language: data?.language_code ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sarvam-stt failed", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "STT failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
