import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require an authenticated user — AI gateway calls cost credits
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, query, lat, lon, medications } = await req.json();
    const supabase = createClient(supabaseUrl, serviceKey);


    if (type === "product_search") {
      // Use AI to extract generic/salt name from branded medication name
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      let searchTerms: string[] = [];

      if (LOVABLE_API_KEY && medications?.length) {
        try {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `You are a pharmacist. Given medication names, extract the generic/salt name and strength. Return ONLY a JSON array of search terms. Example: ["Paracetamol 500", "Metformin 500"]. No markdown, no explanation.`,
                },
                {
                  role: "user",
                  content: `Extract generic names for: ${medications.join(", ")}`,
                },
              ],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            try {
              searchTerms = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
            } catch {
              searchTerms = medications;
            }
          } else {
            searchTerms = medications;
          }
        } catch {
          searchTerms = medications;
        }
      } else {
        searchTerms = query ? [query] : [];
      }

      // Search products for each term
      const results: Record<string, any[]> = {};
      for (const term of searchTerms) {
        const words = term.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        if (words.length === 0) continue;

        // Use ilike for fuzzy matching
        let q = supabase.from("jan_aushadhi_products").select("*");
        for (const word of words.slice(0, 3)) {
          q = q.or(`generic_name.ilike.%${word}%,salt_composition.ilike.%${word}%`);
        }
        const { data } = await q.limit(5);
        if (data?.length) {
          results[term] = data;
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "store_search") {
      let q = supabase.from("jan_aushadhi_stores").select("*");

      if (lat && lon) {
        // Get all stores and sort by distance client-side (no PostGIS)
        const { data } = await q.limit(500);
        const stores = (data || [])
          .filter((s: any) => s.lat && s.lon)
          .map((s: any) => {
            const R = 6371;
            const dLat = ((s.lat - lat) * Math.PI) / 180;
            const dLon = ((s.lon - lon) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos((lat * Math.PI) / 180) *
                Math.cos((s.lat * Math.PI) / 180) *
                Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return { ...s, distance_km: +(R * c).toFixed(1) };
          })
          .sort((a: any, b: any) => a.distance_km - b.distance_km)
          .slice(0, 10);

        return new Response(JSON.stringify({ success: true, stores }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (query) {
        q = q.or(`pincode.eq.${query},district.ilike.%${query}%,state.ilike.%${query}%`);
      }

      const { data } = await q.limit(10);
      return new Response(JSON.stringify({ success: true, stores: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("jan-aushadhi-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
