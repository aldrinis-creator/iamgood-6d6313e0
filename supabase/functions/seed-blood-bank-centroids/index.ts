import { requireCronOrAdmin } from "../_shared/guard.ts";
// One-time bulk state-centroid populator. Gives every blood bank an approximate
// lat/lng (state-level) so the directory works immediately. Run geocode-blood-banks
// afterwards to refine to precise per-address coordinates.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// State / UT centroids (approximate, decimal degrees). Source: public geographic
// references. Used only as an emergency-time fallback while precise geocoding
// runs in the background.
const STATE_CENTROIDS: Record<string, [number, number]> = {
  "Andhra Pradesh": [15.9129, 79.7400],
  "Arunachal Pradesh": [28.2180, 94.7278],
  "Assam": [26.2006, 92.9376],
  "Bihar": [25.0961, 85.3131],
  "Chhattisgarh": [21.2787, 81.8661],
  "Goa": [15.2993, 74.1240],
  "Gujarat": [22.2587, 71.1924],
  "Haryana": [29.0588, 76.0856],
  "Himachal Pradesh": [31.1048, 77.1734],
  "Jharkhand": [23.6102, 85.2799],
  "Karnataka": [15.3173, 75.7139],
  "Kerala": [10.8505, 76.2711],
  "Madhya Pradesh": [22.9734, 78.6569],
  "Maharashtra": [19.7515, 75.7139],
  "Manipur": [24.6637, 93.9063],
  "Meghalaya": [25.4670, 91.3662],
  "Mizoram": [23.1645, 92.9376],
  "Nagaland": [26.1584, 94.5624],
  "Odisha": [20.9517, 85.0985],
  "Punjab": [31.1471, 75.3412],
  "Rajasthan": [27.0238, 74.2179],
  "Sikkim": [27.5330, 88.5122],
  "Tamil Nadu": [11.1271, 78.6569],
  "Telangana": [18.1124, 79.0193],
  "Tripura": [23.9408, 91.9882],
  "Uttar Pradesh": [26.8467, 80.9462],
  "Uttarakhand": [30.0668, 79.0193],
  "West Bengal": [22.9868, 87.8550],
  "Andaman Nicobar": [11.7401, 92.6586],
  "Andaman And Nicobar Islands": [11.7401, 92.6586],
  "Chandigarh": [30.7333, 76.7794],
  "Dadra And Nagar Haveli": [20.1809, 73.0169],
  "Daman And Diu": [20.4283, 72.8397],
  "Delhi": [28.7041, 77.1025],
  "Jammu And Kashmir": [33.7782, 76.5762],
  "Jammu Kashmir": [33.7782, 76.5762],
  "Ladakh": [34.1526, 77.5770],
  "Lakshadweep": [10.5667, 72.6417],
  "Puducherry": [11.9416, 79.8083],
};

const norm = (s: string | null | undefined) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ");

const STATE_LOOKUP = new Map<string, [number, number]>(
  Object.entries(STATE_CENTROIDS).map(([k, v]) => [norm(k), v]),
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const denied = await requireCronOrAdmin(req, corsHeaders);
    if (denied) return denied;

    // Pull every pending row
    const PAGE = 1000;
    let updated = 0;
    let unmatched = 0;
    const unmatchedStates = new Set<string>();
    let offset = 0;
    while (true) {
      const { data, error } = await admin
        .from("blood_banks")
        .select("id,state")
        .eq("geocode_status", "pending")
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data) {
        const key = norm((row as any).state);
        const coords = STATE_LOOKUP.get(key);
        if (!coords) {
          unmatched++;
          unmatchedStates.add((row as any).state || "");
          continue;
        }
        await admin.from("blood_banks").update({
          lat: coords[0],
          lng: coords[1],
          geocode_status: "centroid",
          geocoded_at: new Date().toISOString(),
        }).eq("id", (row as any).id);
        updated++;
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    return new Response(JSON.stringify({
      updated, unmatched, unmatched_states: [...unmatchedStates],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("seed-blood-bank-centroids error:", e);
    return new Response(JSON.stringify({ error: "Request failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
