import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-step-up",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** +9198195****67 style mask — enough to identify, not enough to dial. */
function maskPhone(raw: string | null): string {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length < 6) return "•".repeat(d.length);
  return `+${d.slice(0, 5)}${"•".repeat(Math.max(0, d.length - 9))}${d.slice(-4)}`;
}

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

    // Step-up 2FA check (same contract as the other admin functions).
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

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "list") return json({ error: "Invalid action" }, 400);

    const hours = [24, 24 * 7, 24 * 30].includes(Number(body?.hours)) ? Number(body.hours) : 24;
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const phoneFilter = typeof body?.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    const reveal = body?.reveal === true;

    let query = adminClient
      .from("otp_events")
      // NEVER select otp_hash.
      .select("id, phone, action, status, request_id, delivery_status, delivery_time, failure_reason, verified, expires_at, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (phoneFilter.length >= 3) query = query.like("phone", `%${phoneFilter}%`);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []).map((r) => ({
      ...r,
      phone: reveal ? r.phone : maskPhone(r.phone),
    }));

    const sends = rows.filter((r) => r.action !== "verify").length;
    const verified = rows.filter((r) => r.verified).length;
    const failed = rows.filter((r) => r.status === "failed" || r.delivery_status === "failed").length;

    return json({ rows, summary: { total: rows.length, sends, verified, failed } });
  } catch (err) {
    console.error("[admin-otp-log]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
