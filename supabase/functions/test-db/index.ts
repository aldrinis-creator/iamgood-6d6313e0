import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  
  const { data, error } = await adminClient.from("premium_plus_waitlist").select("*");
  return new Response(JSON.stringify({ data, error }), { headers: { "Content-Type": "application/json" } });
});
