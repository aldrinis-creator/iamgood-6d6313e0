// Admin-only proxy for email queue maintenance tools (stats, failed-email list, retry, clear).
import { requireCronOrAdmin, serviceClient } from "../_shared/guard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const DLQS = new Set(["auth_emails_dlq", "transactional_emails_dlq"]);
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const denied = await requireCronOrAdmin(req, cors);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const db = serviceClient();
    if (action === "stats") {
      const { data, error } = await db.rpc("email_queue_stats");
      if (error) throw error;
      return json({ data });
    }
    const dlq = body?.dlq_name;
    if (!DLQS.has(dlq)) return json({ error: "Invalid queue" }, 400);
    if (action === "read") {
      const limit = Math.min(Math.max(Number(body?.limit_count) || 50, 1), 500);
      const { data, error } = await db.rpc("read_dlq_messages", { dlq_name: dlq, limit_count: limit });
      if (error) throw error;
      return json({ data });
    }
    if (action === "purge") {
      const { data, error } = await db.rpc("purge_dlq", { dlq_name: dlq });
      if (error) throw error;
      return json({ data });
    }
    if (action === "requeue") {
      const id = Number(body?.msg_id);
      if (!Number.isInteger(id) || id < 1) return json({ error: "Invalid message" }, 400);
      const { data, error } = await db.rpc("requeue_dlq_message", { dlq_name: dlq, msg_id: id });
      if (error) throw error;
      return json({ data });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-email-queue error", (e as Error).message);
    return json({ error: "Request failed" }, 500);
  }
});
