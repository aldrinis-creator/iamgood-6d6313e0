// recover-admission-kit
// Scans medical-documents/{wardUserId}/slots/* and creates/repairs
// matching medical_records rows so the Hospital Admission Kit shows
// docs even if the original DB write was lost.
//
// Auth: the caller must be either the ward themselves OR an accepted
// guardian of the ward.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SLOT_DEFS: Record<string, { recordType: string; label: string }> = {
  aadhaar: { recordType: "ID - Aadhaar", label: "Aadhaar Card" },
  pan: { recordType: "ID - PAN", label: "PAN Card" },
  insurance_primary: { recordType: "Insurance - Primary", label: "Health Insurance — Primary" },
  insurance_secondary: { recordType: "Insurance - Secondary", label: "Health Insurance — Secondary" },
  id_photo: { recordType: "ID - Photo", label: "Passport Photo" },
};

function slotFromFileName(name: string): string | null {
  // expected: "{slot}-{timestamp}.{ext}" with slot possibly containing underscore
  const m = name.match(/^([a-z_]+)-\d+\./i);
  if (!m) return null;
  const slot = m[1];
  return SLOT_DEFS[slot] ? slot : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Caller identity (uses RLS via anon + JWT)
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    let body: { wardUserId?: string } = {};
    try { body = await req.json(); } catch { /* empty */ }
    const wardUserId = body.wardUserId || callerId;

    // Authorize: caller is ward OR accepted guardian of ward
    if (wardUserId !== callerId) {
      const { data: g } = await userClient
        .from("guardians")
        .select("id")
        .eq("guardian_user_id", callerId)
        .eq("user_id", wardUserId)
        .eq("status", "accepted")
        .maybeSingle();
      if (!g) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Service client for storage list + DB writes scoped to wardUserId
    const admin = createClient(SUPABASE_URL, SERVICE);

    // List storage objects in {wardUserId}/slots/
    const { data: files, error: listErr } = await admin
      .storage.from("medical-documents")
      .list(`${wardUserId}/slots`, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (listErr) {
      return new Response(JSON.stringify({ error: listErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick latest file per slot
    const latestBySlot: Record<string, { name: string; created: string }> = {};
    for (const f of files || []) {
      if (!f.name) continue;
      const slot = slotFromFileName(f.name);
      if (!slot) continue;
      const created = (f as any).created_at || (f as any).updated_at || "";
      if (!latestBySlot[slot] || created > latestBySlot[slot].created) {
        latestBySlot[slot] = { name: f.name, created };
      }
    }

    // Existing slot-tagged records for this ward
    const { data: existing } = await admin
      .from("medical_records")
      .select("id, record_slot, file_url")
      .eq("user_id", wardUserId)
      .not("record_slot", "is", null);

    const existingBySlot: Record<string, { id: string; file_url: string | null }> = {};
    for (const r of existing || []) {
      if (r.record_slot) existingBySlot[r.record_slot] = { id: r.id, file_url: r.file_url };
    }

    const created: string[] = [];
    const updated: string[] = [];

    for (const [slot, info] of Object.entries(latestBySlot)) {
      const def = SLOT_DEFS[slot];
      const fileUrl = `${wardUserId}/slots/${info.name}`;
      const existingRow = existingBySlot[slot];

      if (!existingRow) {
        const { error: insErr } = await admin.from("medical_records").insert({
          user_id: wardUserId,
          title: def.label,
          record_type: def.recordType,
          record_slot: slot,
          file_url: fileUrl,
          file_name: info.name,
          record_date: new Date().toISOString().slice(0, 10),
        });
        if (!insErr) created.push(slot);
      } else if (existingRow.file_url !== fileUrl) {
        const { error: upErr } = await admin
          .from("medical_records")
          .update({ file_url: fileUrl, file_name: info.name, record_type: def.recordType, title: def.label })
          .eq("id", existingRow.id);
        if (!upErr) updated.push(slot);
      }
    }

    return new Response(JSON.stringify({
      wardUserId,
      slotsFound: Object.keys(latestBySlot),
      created,
      updated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
