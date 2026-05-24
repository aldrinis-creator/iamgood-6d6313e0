import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const VALID_STATUSES = new Set(["new", "in_progress", "resolved"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // Step-up 2FA check
    const stepUpToken = req.headers.get("x-admin-step-up") || "";
    if (!stepUpToken) return json({ error: "Step-up required" }, 403);
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stepUpToken));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data: stepRow } = await adminClient
      .from("admin_step_up_tokens")
      .select("id")
      .eq("token_hash", tokenHash)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!stepRow) return json({ error: "Invalid or expired step-up token" }, 403);

    const { action, ...payload } = await req.json();

    switch (action) {
      case "list": {
        const { data, error } = await adminClient
          .from("contact_submissions")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }

      case "export": {
        const { data, error } = await adminClient
          .from("contact_submissions")
          .select("email, full_name, phone, subject, message, source, status, created_at, responded_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const headers = ["Email", "Name", "Phone", "Subject", "Message", "Source", "Status", "Submitted", "Responded"];
        const rows = (data ?? []).map((r: Record<string, unknown>) => [
          r.email, r.full_name, r.phone, r.subject, r.message, r.source, r.status, r.created_at, r.responded_at,
        ].map(csvEscape).join(","));
        const csv = [headers.join(","), ...rows].join("\n");
        return new Response(csv, {
          headers: { ...corsHeaders, "Content-Type": "text/csv" },
        });
      }

      case "update_status": {
        const { id, status } = payload;
        if (!id || !VALID_STATUSES.has(status)) {
          return json({ error: "id and valid status required" }, 400);
        }
        const update: Record<string, unknown> = { status };
        if (status !== "new") update.responded_at = new Date().toISOString();
        const { data, error } = await adminClient
          .from("contact_submissions")
          .update(update)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      case "add_note": {
        const { id, admin_notes } = payload;
        if (!id) return json({ error: "id is required" }, 400);
        const { data, error } = await adminClient
          .from("contact_submissions")
          .update({ admin_notes: admin_notes ?? null })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      default:
        return json({ error: "Invalid action" }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
