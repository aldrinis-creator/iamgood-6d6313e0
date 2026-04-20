import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYNTHETIC_DOMAIN = "admin.checkin.local";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128)
  .refine((p) => /[A-Z]/.test(p), "Must include an uppercase letter")
  .refine((p) => /[a-z]/.test(p), "Must include a lowercase letter")
  .refine((p) => /[0-9]/.test(p), "Must include a number")
  .refine((p) => /[^A-Za-z0-9]/.test(p), "Must include a symbol");

const adminIdSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, "Admin ID must be alphanumeric/underscore only");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
  req.headers.get("x-real-ip") ||
  "unknown";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = body?.action;
  const ip = getIp(req);
  const ua = req.headers.get("user-agent") || "";

  const audit = (user_id: string | null, actionName: string, metadata: any = {}) =>
    admin.from("admin_audit_log").insert({ user_id, action: actionName, ip, user_agent: ua, metadata });

  try {
    if (action === "exists") {
      const { count } = await admin
        .from("admin_credentials")
        .select("id", { count: "exact", head: true });
      return json({ exists: (count ?? 0) > 0 });
    }

    if (action === "setup") {
      const { count } = await admin
        .from("admin_credentials")
        .select("id", { count: "exact", head: true });
      if ((count ?? 0) > 0) return json({ error: "Admin already configured" }, 403);

      const idParse = adminIdSchema.safeParse(body.admin_id);
      if (!idParse.success) return json({ error: idParse.error.errors[0].message }, 400);
      const pwParse = passwordSchema.safeParse(body.password);
      if (!pwParse.success) return json({ error: pwParse.error.errors[0].message }, 400);

      const adminId = idParse.data.toLowerCase();
      const email = `${adminId}@${SYNTHETIC_DOMAIN}`;

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: pwParse.data,
        email_confirm: true,
        user_metadata: { full_name: adminId, app_role: "admin" },
      });
      if (createErr || !created.user) return json({ error: createErr?.message || "Could not create admin" }, 500);

      const userId = created.user.id;

      await admin.from("admin_credentials").insert({ admin_id: adminId, user_id: userId });
      await admin.from("user_roles").insert({ user_id: userId, role: "admin" }).then(() => {});
      await audit(userId, "admin_setup", { admin_id: adminId });

      return json({ success: true });
    }

    if (action === "login") {
      const adminId = String(body.admin_id || "").toLowerCase().trim();
      const password = String(body.password || "");
      if (!adminId || !password) return json({ error: "Missing credentials" }, 400);

      // Lockout: 5 fails from this IP in last 15 min
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { count: failCount } = await admin
        .from("admin_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .eq("success", false)
        .gte("created_at", since);

      if ((failCount ?? 0) >= 5) {
        await audit(null, "admin_login_locked", { ip, admin_id: adminId });
        return json({ error: "Too many failed attempts. Try again in 15 minutes." }, 429);
      }

      const { data: cred } = await admin
        .from("admin_credentials")
        .select("admin_id, user_id")
        .eq("admin_id", adminId)
        .maybeSingle();

      if (!cred) {
        await admin.from("admin_login_attempts").insert({ admin_id: adminId, ip, success: false });
        await audit(null, "admin_login_failed", { admin_id: adminId, reason: "unknown_id" });
        return json({ error: "Invalid credentials" }, 401);
      }

      const email = `${cred.admin_id}@${SYNTHETIC_DOMAIN}`;
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });

      if (signInErr || !signInData.session) {
        await admin.from("admin_login_attempts").insert({ admin_id: adminId, ip, success: false });
        await audit(cred.user_id, "admin_login_failed", { admin_id: adminId, reason: "bad_password" });
        return json({ error: "Invalid credentials" }, 401);
      }

      await admin.from("admin_login_attempts").insert({ admin_id: adminId, ip, success: true });
      await admin.from("admin_credentials").update({ last_login_at: new Date().toISOString() }).eq("admin_id", adminId);
      await audit(cred.user_id, "admin_login_success", { admin_id: adminId });

      return json({
        success: true,
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        },
      });
    }

    if (action === "change_password") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

      const { data: cred } = await admin
        .from("admin_credentials")
        .select("admin_id, user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!cred) return json({ error: "Forbidden" }, 403);

      const current = String(body.current_password || "");
      const newPw = body.new_password;
      const pwParse = passwordSchema.safeParse(newPw);
      if (!pwParse.success) return json({ error: pwParse.error.errors[0].message }, 400);

      const email = `${cred.admin_id}@${SYNTHETIC_DOMAIN}`;
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      const { error: verifyErr } = await anon.auth.signInWithPassword({ email, password: current });
      if (verifyErr) return json({ error: "Current password incorrect" }, 401);

      const { error: updErr } = await admin.auth.admin.updateUserById(cred.user_id, { password: pwParse.data });
      if (updErr) return json({ error: updErr.message }, 500);

      await audit(cred.user_id, "admin_password_changed", { admin_id: cred.admin_id });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-auth error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
