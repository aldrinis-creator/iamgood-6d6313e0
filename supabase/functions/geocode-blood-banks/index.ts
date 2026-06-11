// Batch geocoder for the blood_banks directory.
// Admin-triggered (auth check via has_role). Runs through the Lovable
// Google Maps connector gateway so the browser key never leaks server-side.
// Idempotent + resumable: only processes rows with geocode_status = 'pending'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

interface Row {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  state: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocodeOne(query: string, lovableKey: string, mapsKey: string) {
  const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=in`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
    },
  });
  if (!res.ok) {
    return { ok: false as const, status: res.status };
  }
  const json = await res.json();
  if (json.status !== "OK" || !json.results?.length) {
    return { ok: false as const, status: 0, gstatus: json.status };
  }
  const loc = json.results[0].geometry?.location;
  if (!loc) return { ok: false as const, status: 0 };
  return { ok: true as const, lat: loc.lat as number, lng: loc.lng as number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!lovableKey || !mapsKey) {
      return new Response(
        JSON.stringify({ error: "Google Maps connector not linked" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Admin gate: validate caller JWT and check has_role('admin')
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body?.batchSize) || 100, 1), 500);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: rows, error: selErr } = await admin
      .from("blood_banks")
      .select("id,name,address,district,state")
      .eq("geocode_status", "pending")
      .limit(batchSize);

    if (selErr) throw selErr;
    const pending = (rows || []) as Row[];

    let ok = 0;
    let failed = 0;
    for (const row of pending) {
      const queryParts = [row.name, row.address, row.district, row.state, "India"].filter(Boolean);
      const query = queryParts.join(", ");
      const r = await geocodeOne(query, lovableKey, mapsKey);

      if (r.ok) {
        await admin
          .from("blood_banks")
          .update({ lat: r.lat, lng: r.lng, geocode_status: "ok", geocoded_at: new Date().toISOString() })
          .eq("id", row.id);
        ok++;
      } else {
        // Fallback: district-level centroid lookup
        const fallback = [row.district, row.state, "India"].filter(Boolean).join(", ");
        const f = fallback ? await geocodeOne(fallback, lovableKey, mapsKey) : { ok: false as const };
        if (f.ok) {
          await admin
            .from("blood_banks")
            .update({
              lat: f.lat,
              lng: f.lng,
              geocode_status: "centroid",
              geocoded_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          ok++;
        } else {
          await admin
            .from("blood_banks")
            .update({ geocode_status: "failed", geocoded_at: new Date().toISOString() })
            .eq("id", row.id);
          failed++;
        }
      }
      // Gentle pacing to stay well under Google QPS limits
      await sleep(60);
    }

    const { count: remaining } = await admin
      .from("blood_banks")
      .select("id", { count: "exact", head: true })
      .eq("geocode_status", "pending");

    return new Response(
      JSON.stringify({ processed: pending.length, ok, failed, remaining }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("geocode-blood-banks error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
