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
          .from("premium_plus_waitlist")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }

      case "export": {
        const { data, error } = await adminClient
          .from("premium_plus_waitlist")
          .select("email, full_name, phone, source, created_at, notified_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const headers = ["Email", "Name", "Phone", "Source", "Joined", "Notified"];
        const rows = (data ?? []).map((r: Record<string, unknown>) => [
          r.email, r.full_name, r.phone, r.source, r.created_at, r.notified_at,
        ].map(csvEscape).join(","));
        const csv = [headers.join(","), ...rows].join("\n");
        return new Response(csv, {
          headers: { ...corsHeaders, "Content-Type": "text/csv" },
        });
      }

      case "mark_notified": {
        const { id, notified } = payload;
        if (!id) return json({ error: "id is required" }, 400);
        const { data, error } = await adminClient
          .from("premium_plus_waitlist")
          .update({ notified_at: notified === false ? null : new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      case "notify_all": {
        const { data: rows, error: fetchErr } = await adminClient
          .from("premium_plus_waitlist")
          .select("id, email, full_name")
          .is("notified_at", null);
        if (fetchErr) throw fetchErr;
        if (!rows || rows.length === 0) return json({ queued: 0, failed: 0 });

        let queued = 0;
        let failed = 0;
        for (const row of rows) {
          try {
            const { error: invokeErr } = await adminClient.functions.invoke(
              "send-transactional-email",
              {
                body: {
                  templateName: "premium-plus-launch",
                  recipientEmail: row.email,
                  idempotencyKey: `pp-launch-${row.id}`,
                  templateData: { name: row.full_name },
                },
              }
            );
            if (invokeErr) throw invokeErr;
            await adminClient
              .from("premium_plus_waitlist")
              .update({ notified_at: new Date().toISOString() })
              .eq("id", row.id);
            queued++;
          } catch (e) {
            console.error("notify_all failed for", row.email, e);
            failed++;
          }
        }
        return json({ queued, failed });
      }

      default:
        return json({ error: "Invalid action" }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
