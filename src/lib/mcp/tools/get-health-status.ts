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
  description: "Return the signed-in user's latest Health Passport score (with category breakdown) and today's check-in responses.",
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
        .from("health_passport_scores")
        .select("overall, activity, checkin, medications, nutrition, vitals, wellness, score_date")
        .eq("user_id", userId)
        .order("score_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("check_ins")
        .select("id, scheduled_at, responded_at, status, response")
        .eq("user_id", userId)
        .gte("scheduled_at", `${today}T00:00:00.000Z`)
        .lte("scheduled_at", `${today}T23:59:59.999Z`)
        .order("scheduled_at", { ascending: true }),
    ]);

    const summary = {
      healthPassport: passportRes.data ?? null,
      todaysCheckIns: checkInRes.data ?? [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
