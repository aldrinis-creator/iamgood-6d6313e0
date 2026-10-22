import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-oh-signature, x-oh-event-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

function jsonResponse(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  if (!clean || clean.length % 2 !== 0 || !/^[0-9a-f]+$/.test(clean)) {
    return new Uint8Array();
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function fromBase64(b64: string): Uint8Array {
  try {
    const bin = atob(b64.trim());
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array();
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, payload: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPath(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function findString(payload: unknown, paths: string[][]): string | null {
  return firstString(paths.map((path) => getPath(payload, path)));
}

function normalizeEvent(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, ".").replace(/\s+/g, ".");
}

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function getEventName(payload: unknown, headerEvent: string): string | null {
  const fromBody = findString(payload, [
    ["event"],
    ["event_name"],
    ["eventName"],
    ["type"],
    ["name"],
    ["data", "event"],
    ["data", "event_name"],
    ["data", "eventName"],
  ]);
  const candidate = fromBody || headerEvent;
  return candidate ? normalizeEvent(candidate) : null;
}

function getRequestId(payload: unknown): string | null {
  return findString(payload, [
    ["request_id"],
    ["requestId"],
    ["city_request_id"],
    ["cityRequestId"],
    ["oms_request_id"],
    ["omsRequestId"],
    ["data", "request_id"],
    ["data", "requestId"],
    ["data", "city_request_id"],
    ["data", "cityRequestId"],
    ["data", "oms_request_id"],
    ["data", "omsRequestId"],
    ["order", "request_id"],
    ["order", "requestId"],
    ["order", "id"],
    ["data", "order", "request_id"],
    ["data", "order", "requestId"],
    ["data", "order", "id"],
  ]);
}

function getScheduledTime(payload: unknown): string | null {
  const value = findString(payload, [
    ["slot_datetime"],
    ["slotDatetime"],
    ["requested_slot_time"],
    ["scheduled_time"],
    ["scheduledTime"],
    ["confirmed_time"],
    ["confirmedTime"],
    ["collection_time"],
    ["collectionTime"],
    ["preferred_time"],
    ["preferredTime"],
    ["data", "slot_datetime"],
    ["data", "slotDatetime"],
    ["data", "requested_slot_time"],
    ["data", "scheduled_time"],
    ["data", "scheduledTime"],
    ["data", "confirmed_time"],
    ["data", "confirmedTime"],
    ["data", "collection_time"],
    ["data", "collectionTime"],
    ["data", "preferred_time"],
    ["data", "preferredTime"],
    ["task", "slot_datetime"],
    ["task", "scheduled_time"],
    ["task", "scheduledTime"],
    ["task", "confirmed_time"],
    ["task", "confirmedTime"],
    ["task", "collection_time"],
    ["task", "collectionTime"],
  ]);
  if (!value) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function mapEvent(eventName: string): { status?: string; lifecycle: string; updateSlot: boolean } | null {
  switch (eventName) {
    case "order.created":
      return { status: "requested", lifecycle: "initiated", updateSlot: false };
    case "task.confirmed":
      return { status: "scheduled", lifecycle: "scheduled", updateSlot: true };
    case "task.assigned":
      return { lifecycle: "phlebo_assigned", updateSlot: false };
    case "task.accepted":
      return { lifecycle: "phlebo_accepted", updateSlot: false };
    case "task.started":
      return { lifecycle: "emedic_on_the_way", updateSlot: false };
    case "task.in-progress":
    case "task.inprogress":
      return { lifecycle: "collection_in_progress", updateSlot: false };
    case "task.completed":
      return { status: "completed", lifecycle: "sample_collected", updateSlot: false };
    case "order.cancelled":
    case "order.canceled":
      return { status: "cancelled", lifecycle: "cancelled", updateSlot: false };
    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const secret = Deno.env.get("ORANGE_WEBHOOK_SECRET");
    if (!secret) {
      console.error("ORANGE_WEBHOOK_SECRET is not configured");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const signature = (req.headers.get("x-oh-signature") ?? "").trim();
    const eventId = req.headers.get("x-oh-event-id") ?? "";
    const rawBody = await req.text();

    if (!signature) {
      console.error("Orange webhook missing signature", { eventIdPresent: Boolean(eventId) });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const macBuf = await hmacSha256(secret, rawBody);
    const macHex = toHex(macBuf);
    const macBytes = new Uint8Array(macBuf);
    const stripped = signature.replace(/^sha256=/i, "");
    const matched =
      timingSafeEqual(macBytes, fromHex(signature)) ||
      timingSafeEqual(macBytes, fromBase64(signature)) ||
      timingSafeEqual(macBytes, fromHex(stripped)) ||
      timingSafeEqual(macBytes, fromBase64(stripped)) ||
      signature.toLowerCase() === macHex ||
      stripped.toLowerCase() === macHex;

    if (!matched) {
      console.error("Orange webhook signature mismatch", {
        eventIdPresent: Boolean(eventId),
        signatureLength: signature.length,
        bodyLength: rawBody.length,
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid JSON payload" }, 400);
    }
    if (!isObject(payload)) return jsonResponse({ error: "Webhook payload must be a JSON object" }, 400);

    const headerEvent = req.headers.get("x-oh-event-name") ?? req.headers.get("x-oh-event") ?? "";
    const eventName = getEventName(payload, headerEvent);
    if (!eventName) {
      console.warn("Verified Orange webhook had no recognizable event name", {
        eventIdPresent: Boolean(eventId),
        topLevelKeys: Object.keys(payload),
      });
      // Acknowledge a verified event to avoid retries while payload format is being confirmed.
      return jsonResponse({ success: true, processed: false, reason: "Event name not found in payload" });
    }

    const mapping = mapEvent(eventName);
    if (!mapping) {
      console.log("Ignoring unhandled verified Orange webhook event", { eventName, eventIdPresent: Boolean(eventId) });
      return jsonResponse({ success: true, processed: false, reason: "Event not handled", event: eventName });
    }

    const requestId = getRequestId(payload);
    if (!requestId) {
      console.warn("Verified Orange webhook has no recognizable request ID", {
        eventName,
        eventIdPresent: Boolean(eventId),
        topLevelKeys: Object.keys(payload),
      });
      // Do not return a failure for a verified event because this may cause repeated provider deliveries.
      return jsonResponse({ success: true, processed: false, reason: "Request ID not found", event: eventName });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase service environment is not configured");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find every local row belonging to this Orange Health request. One provider request
    // may contain more than one patient/order, so update all matching rows.
    const { data: rows, error: selectError } = await serviceClient
      .from("lab_orders")
      .select("id, status, slot_datetime, raw_response")
      .eq("city_request_id", requestId);

    if (selectError) {
      console.error("Failed to find local orders for verified webhook", { eventName, requestId, error: selectError.message });
      return jsonResponse({ error: "Could not find local booking records" }, 500);
    }

    if (!rows || rows.length === 0) {
      console.warn("No local booking matched verified Orange webhook", { eventName, requestId });
      // The provider may deliver order.created before the local insert finishes.
      // Acknowledge to prevent an endless retry; the event can be reconciled later.
      return jsonResponse({ success: true, processed: false, reason: "No matching local booking", event: eventName });
    }

    const scheduledTime = mapping.updateSlot ? getScheduledTime(payload) : null;
    const lifecycleEvent = {
      event: eventName,
      event_id: eventId || null,
      received_at: new Date().toISOString(),
    };

    let updatedCount = 0;
    for (const row of rows) {
      const oldRaw = isObject(row.raw_response) ? row.raw_response : {};
      const oldWebhook = isObject(oldRaw.webhook_state) ? oldRaw.webhook_state : {};
      const oldEvents = Array.isArray(oldWebhook.recent_events) ? oldWebhook.recent_events : [];
      const nextRaw: JsonObject = {
        ...oldRaw,
        webhook_state: {
          ...oldWebhook,
          latest_event: eventName,
          latest_event_id: eventId || null,
          latest_event_at: lifecycleEvent.received_at,
          lifecycle_stage: mapping.lifecycle,
          recent_events: [...oldEvents.slice(-9), lifecycleEvent],
        },
      };

      const update: JsonObject = {
        raw_response: nextRaw,
        updated_at: lifecycleEvent.received_at,
      };
      if (mapping.status) update.status = mapping.status;
      if (scheduledTime) update.slot_datetime = scheduledTime;

      const { error: updateError } = await serviceClient
        .from("lab_orders")
        .update(update)
        .eq("id", row.id);

      if (updateError) {
        console.error("Failed to update local booking from Orange webhook", {
          eventName,
          requestId,
          rowId: row.id,
          error: updateError.message,
        });
        return jsonResponse({ error: "Failed to update local booking" }, 500);
      }
      updatedCount++;
    }

    console.log("Orange webhook processed", {
      eventName,
      requestId,
      updatedCount,
      statusUpdated: Boolean(mapping.status),
      slotUpdated: Boolean(scheduledTime),
    });

    return jsonResponse({
      success: true,
      processed: true,
      event: eventName,
      status: mapping.status ?? null,
      slotUpdated: Boolean(scheduledTime),
      updatedCount,
    });
  } catch (error) {
    console.error("Error processing Orange webhook", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse({ error: "Internal Server Error" }, 500);
  }
});
