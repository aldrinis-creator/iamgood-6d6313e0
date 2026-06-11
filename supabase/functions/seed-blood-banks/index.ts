// One-time seed for the blood_banks table from the CSV at
// internal-seeds/blood_banks_march_2026.csv. Idempotent — only inserts
// rows whose source_sno is not already present.
//
// Admin-only: caller must present a JWT with has_role('admin').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "internal-seeds";
const KEY = "blood_banks_march_2026.csv";

function parseCsv(text: string): Record<string, string>[] {
  // Minimal CSV parser supporting quoted fields with embedded commas.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length === headers.length).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = r[i]));
    return obj;
  });
}

const clean = (s: string | undefined | null) => {
  if (!s) return null;
  const t = s.trim();
  if (!t || t === "-" || t === "--") return null;
  return t;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const isService = jwt === serviceKey;
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

    const admin = createClient(supabaseUrl, serviceKey);

    // Download CSV from storage
    const dl = await admin.storage.from(BUCKET).download(KEY);
    if (dl.error || !dl.data) {
      return new Response(JSON.stringify({ error: "CSV not found", detail: dl.error?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = await dl.data.text();
    const rows = parseCsv(text);

    // Check existing source_snos to make seed idempotent
    const { data: existingRows } = await admin
      .from("blood_banks")
      .select("source_sno")
      .not("source_sno", "is", null);
    const existing = new Set((existingRows || []).map((r: any) => r.source_sno));

    const toInsert = rows
      .map((r) => ({
        source_sno: Number(r["S.No."]) || null,
        state: clean(r["State"]),
        name: clean(r["Blood Center"]),
        address: clean(r["Address"]),
        district: clean(r["District"]),
        category: clean(r["Category"]),
        phone: clean(r["Phone"]),
        email: clean(r["Email"]),
      }))
      .filter((r) => r.name && r.source_sno && !existing.has(r.source_sno));

    let inserted = 0;
    const batchSize = 500;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { error } = await admin.from("blood_banks").insert(batch);
      if (error) {
        return new Response(JSON.stringify({ error: error.message, inserted, at: i }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inserted += batch.length;
    }

    const { count } = await admin
      .from("blood_banks").select("id", { count: "exact", head: true });

    return new Response(JSON.stringify({
      parsed: rows.length,
      skipped_existing: rows.length - toInsert.length,
      inserted,
      total_in_table: count,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("seed-blood-banks error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
