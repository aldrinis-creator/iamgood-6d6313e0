import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_medications_today",
  title: "List today's medications",
  description: "Return the signed-in user's active medications scheduled for today, including dose, times, and last taken.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("medications")
      .select("id, name, dose, frequency, times, notes, is_active")
      .eq("user_id", ctx.getUserId())
      .eq("is_active", true)
      .order("name");

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const rows = data ?? [];
    return {
      content: [{ type: "text", text: rows.length ? JSON.stringify(rows, null, 2) : "No active medications." }],
      structuredContent: { medications: rows, count: rows.length },
    };
  },
});
