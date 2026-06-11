// Batch geocoder for the blood_banks directory.
// Uses OpenStreetMap Nominatim (free, no API key) with 1-req/sec rate limiting.
// Idempotent + resumable: only processes rows with geocode_status = 'pending'.
// Falls back to district + state lookup when a full-address geocode fails.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Row {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  state: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CheckiN-BloodBanks/1.0 (https://iamgood.lovable.app)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const lat = parseFloat(arr[0].lat);
    const lng = parseFloat(arr[0].lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const isService = jwt && jwt === serviceKey;
    if (!isService) {
      if (!userData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await userClient.rpc("has_role", {
        _user_id: userData.user.id, _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body?.batchSize) || 60, 1), 120);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: rows, error: selErr } = await admin
      .from("blood_banks")
      .select("id,name,address,district,state")
      .eq("geocode_status", "pending")
      .limit(batchSize);
    if (selErr) throw selErr;
    const pending = (rows || []) as Row[];

    let ok = 0;
    let centroid = 0;
    let failed = 0;
    for (const row of pending) {
      // Strategy 1: name + city tail of address + district + state
      const addrTail = (row.address || "").split(",").slice(-3).join(",").trim();
      const fullQ = [row.name, addrTail, row.district, row.state, "India"].filter(Boolean).join(", ");
      let result = await nominatim(fullQ);
      await sleep(1100); // Nominatim Usage Policy: max 1 req/s

      let status: "ok" | "centroid" | "failed" = "failed";
      if (result) {
        status = "ok"; ok++;
      } else {
        // Strategy 2: district + state centroid
        const centroidQ = [row.district, row.state, "India"].filter(Boolean).join(", ");
        if (centroidQ) {
          result = await nominatim(centroidQ);
          await sleep(1100);
          if (result) { status = "centroid"; centroid++; }
        }
        if (!result) failed++;
      }

      await admin.from("blood_banks").update({
        lat: result?.lat ?? null,
        lng: result?.lng ?? null,
        geocode_status: status,
        geocoded_at: new Date().toISOString(),
      }).eq("id", row.id);
    }

    const { count: remaining } = await admin
      .from("blood_banks").select("id", { count: "exact", head: true })
      .eq("geocode_status", "pending");

    return new Response(JSON.stringify({
      processed: pending.length, ok, centroid, failed, remaining,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("geocode-blood-banks error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
