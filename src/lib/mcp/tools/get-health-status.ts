import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_health_status",
  title: "Get today's health status",
  description: "Return the signed-in user's most recent Health Passport score and today's check-in status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const today = new Date().toISOString().slice(0, 10);

    const [passportRes, checkInRes] = await Promise.all([
      supabase
        .from("health_passport")
        .select("score, recorded_at, categories")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("check_ins")
        .select("id, check_in_time, window_key, mood")
        .eq("user_id", userId)
        .gte("check_in_time", `${today}T00:00:00.000Z`)
        .order("check_in_time", { ascending: false }),
    ]);

    const passport = passportRes.data ?? null;
    const checkIns = checkInRes.data ?? [];

    const summary = {
      passportScore: passport?.score ?? null,
      passportRecordedAt: passport?.recorded_at ?? null,
      todaysCheckIns: checkIns,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
