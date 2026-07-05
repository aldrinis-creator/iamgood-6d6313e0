import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_medications_today",
  title: "List today's medications",
  description: "Return the signed-in user's currently active medications and their scheduled times for today.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("medications")
      .select("id, name, dosage, frequency, schedule_times, instructions, start_date, end_date")
      .eq("user_id", ctx.getUserId())
      .lte("start_date", today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order("name");

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const rows = data ?? [];
    return {
      content: [{ type: "text", text: rows.length ? JSON.stringify(rows, null, 2) : "No active medications for today." }],
      structuredContent: { medications: rows, count: rows.length },
    };
  },
});
