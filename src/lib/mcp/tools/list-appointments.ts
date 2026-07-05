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
  name: "list_upcoming_appointments",
  title: "List upcoming appointments",
  description: "Return the signed-in user's upcoming medical appointments (today onward), ordered by date and time.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max appointments to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("appointments")
      .select("id, title, appointment_type, doctor_name, location, start_date, start_time, end_time, description")
      .eq("user_id", ctx.getUserId())
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(limit ?? 10);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const rows = data ?? [];
    return {
      content: [{ type: "text", text: rows.length ? JSON.stringify(rows, null, 2) : "No upcoming appointments." }],
      structuredContent: { appointments: rows, count: rows.length },
    };
  },
});
