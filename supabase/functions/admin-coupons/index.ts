import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step-up 2FA check
    const stepUpToken = req.headers.get("x-admin-step-up") || "";
    if (!stepUpToken) {
      return new Response(JSON.stringify({ error: "Step-up required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stepUpToken));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data: stepRow } = await adminClient
      .from("admin_step_up_tokens")
      .select("id")
      .eq("token_hash", tokenHash)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!stepRow) {
      return new Response(JSON.stringify({ error: "Invalid or expired step-up token" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const { action, ...payload } = await req.json();

    let result;

    switch (action) {
      case "list": {
        const { data, error } = await adminClient
          .from("coupons")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "create": {
        const { code, discount_type, discount_value, applicable_plans, expires_at, max_uses, is_active } = payload;
        if (!code || !discount_value) {
          return new Response(JSON.stringify({ error: "Code and discount_value are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await adminClient.from("coupons").insert({
          code: code.toUpperCase().trim(),
          discount_type: discount_type || "percentage",
          discount_value,
          applicable_plans: applicable_plans || ["basic", "premium"],
          expires_at: expires_at || null,
          max_uses: max_uses || null,
          is_active: is_active ?? true,
        }).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      case "update": {
        const { id, ...fields } = payload;
        if (!id) {
          return new Response(JSON.stringify({ error: "id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (fields.code) fields.code = fields.code.toUpperCase().trim();
        const { data, error } = await adminClient
          .from("coupons")
          .update(fields)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "delete": {
        const { id } = payload;
        if (!id) {
          return new Response(JSON.stringify({ error: "id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await adminClient.from("coupons").delete().eq("id", id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
