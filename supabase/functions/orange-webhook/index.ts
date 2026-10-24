import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Orange Health Labs -> Check-iN webhook receiver.
 *
 * Payload contract (from Orange Health partner docs):
 *   { event: "order.created", contains: [...], payload: { order, request, tests, reports, ... } }
 *   Headers: x-oh-signature (HMAC-SHA256 of the raw body), x-oh-event-id (UUID, idempotency key)
 *
 * Handled events:
 *   order.created        -> status requested, stores per-test info (fasting, TAT)
 *   task.confirmed       -> status scheduled, slot from payload.request.scheduled_on
 *   task.assigned / accepted / started / in_progress -> lifecycle stage only
 *   task.completed       -> status sample_collected (NOT final; no report yet)
 *   test.completed_sent  -> partial report info (report_data only; status/report_url untouched)
 *   order.completed      -> status completed (= report ready), report_url + report_data
 *   order.cancelled      -> status cancelled, cancellation details
 *
 * Safety rules:
 *   - Request lookup uses payload.order.city_request_id (human readable, e.g. "BLR5383272"),
 *     never the numeric internal ids.
 *   - Duplicate deliveries are ignored via x-oh-event-id.
 *   - Status and lifecycle only move forward (late/out-of-order events cannot regress them).
 *   - Per-patient events (order.completed, test.completed_sent) are only applied to the row of
 *     that patient's order; if the row cannot be identified the event is skipped, never guessed.
 *   - Only tokenize_public_file_url is stored for reports (never file_url).
 *   - Slot times follow the app convention: IST wall-clock time stored without timezone shift.
 */

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

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

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

/** Orange's docs say "HMAC SHA256" without stating the encoding, so accept hex or base64. */
async function signatureMatches(secret: string, rawBody: string, signature: string): Promise<boolean> {
  const macBuf = await hmacSha256(secret, rawBody);
  const macHex = toHex(macBuf);
  const macBytes = new Uint8Array(macBuf);
  const stripped = signature.replace(/^sha256=/i, "");
  return (
    timingSafeEqual(macBytes, fromHex(stripped)) ||
    timingSafeEqual(macBytes, fromBase64(stripped)) ||
    stripped.toLowerCase() === macHex
  );
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function obj(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    const s = str(value);
    if (s) return s;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

interface EventRule {
  /** New local status for lab_orders.status (forward-only). */
  status?: string;
  /** Lifecycle stage recorded in raw_response.webhook_state.lifecycle_stage (forward-only). */
  stage: string;
  /**
   * "request": applies to every local row of the request.
   * "order":   applies only to the row of the patient order named in the payload.
   */
  scope: "request" | "order";
  updateSlot?: boolean;
  reports?: "final" | "partial";
  captureCancellation?: boolean;
  captureTests?: boolean;
}

const EVENT_RULES: Record<string, EventRule> = {
  "order.created": { status: "requested", stage: "initiated", scope: "request", captureTests: true },
  "task.confirmed": { status: "scheduled", stage: "scheduled", scope: "request", updateSlot: true },
  "task.assigned": { stage: "phlebo_assigned", scope: "request" },
  "task.accepted": { stage: "phlebo_accepted", scope: "request" },
  "task.started": { stage: "emedic_on_the_way", scope: "request" },
  "task.in_progress": { stage: "collection_in_progress", scope: "request" },
  "task.completed": { status: "sample_collected", stage: "sample_collected", scope: "request" },
  "test.completed_sent": { stage: "partial_report_available", scope: "order", reports: "partial" },
  "order.completed": { status: "completed", stage: "report_ready", scope: "order", reports: "final" },
  // The Cancel API cancels the whole request, so a cancellation applies to all local rows of it.
  "order.cancelled": { status: "cancelled", stage: "cancelled", scope: "request", captureCancellation: true },
};

const EVENT_ALIASES: Record<string, string> = {
  "task.inprogress": "task.in_progress",
  "order.canceled": "order.cancelled",
};

function normalizeEventName(value: string): string {
  const name = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return EVENT_ALIASES[name] ?? name;
}

/**
 * Local status ladder. Higher can never be replaced by lower (except cancelled, see canApplyStatus).
 * Legacy/pending values written by the orange-health function are included so the webhook can
 * resolve them (e.g. reschedule_pending -> scheduled once task.confirmed arrives).
 */
const STATUS_RANK: Record<string, number> = {
  requested: 10,
  booked: 10,
  scheduled: 20,
  confirmed: 20,
  reschedule_pending: 20,
  cancellation_pending: 25,
  cancelled_pending: 25,
  sample_collected: 40,
  completed: 50,
  cancelled: 90,
  canceled: 90,
};

function statusRank(status: string | null | undefined): number {
  return STATUS_RANK[(status ?? "").toLowerCase()] ?? 0;
}

const STAGE_RANK: Record<string, number> = {
  initiated: 1,
  scheduled: 2,
  phlebo_assigned: 3,
  phlebo_accepted: 4,
  emedic_on_the_way: 5,
  collection_in_progress: 6,
  sample_collected: 7,
  partial_report_available: 8,
  report_ready: 9,
  cancelled: 99,
};

function stageRank(stage: unknown): number {
  return typeof stage === "string" ? STAGE_RANK[stage] ?? 0 : 0;
}

function canApplyStatus(current: string, next: string): boolean {
  const currentRank = statusRank(current);
  const nextRank = statusRank(next);
  if (next === "cancelled") {
    // A finished order (report ready) cannot be cancelled afterwards; cancelled stays cancelled.
    return currentRank < statusRank("completed") || currentRank === statusRank("cancelled");
  }
  return nextRank >= currentRank;
}

const PAYMENT_RANK: Record<string, number> = { pending: 0, paid: 2, cancelled: 3, refunded: 4 };

function mapPaymentStatus(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/^payment_/, "");
  switch (s) {
    case "not_issued":
      return "pending";
    case "canceled":
      return "cancelled";
    default:
      return s || null;
  }
}

// ---------------------------------------------------------------------------
// Payload extraction
// ---------------------------------------------------------------------------

/**
 * Orange wraps everything in a top-level `payload` key. Be tolerant of an unwrapped body too.
 */
function unwrapBody(payload: JsonObject): JsonObject {
  return isObject(payload.payload) ? payload.payload : payload;
}

function getEventName(payload: JsonObject, headers: Headers): string | null {
  const candidate =
    firstString([payload.event, payload.event_name, payload.eventName]) ??
    firstString([headers.get("x-oh-event-name"), headers.get("x-oh-event")]);
  return candidate ? normalizeEventName(candidate) : null;
}

/** Human-readable request id such as "BLR5383272". Numeric internal ids are deliberately NOT used. */
function getRequestId(payload: JsonObject, body: JsonObject): string | null {
  const reports = Array.isArray(body.reports) ? body.reports : [];
  return firstString([
    obj(body.order).city_request_id,
    obj(body.request).city_request_id,
    obj(body.test).city_request_id,
    obj(reports[0]).city_request_id,
    body.city_request_id,
    payload.city_request_id,
  ]);
}

/**
 * Orange sends e.g. "2026-02-17T15:05:00+05:30". The app stores/shows IST wall-clock time as-is
 * (create-order stores the naive slot string; the UI reads the digits). Convert any offset-bearing
 * timestamp to IST wall clock and return it without an offset so it matches that convention.
 */
function toIstWallClock(value: string | null): string | null {
  if (!value) return null;
  const m = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss = "00", tz] = m;
  if (!tz) return `${y}-${mo}-${d}T${hh}:${mm}:${ss}`;

  let offsetMinutes = 0;
  if (tz.toUpperCase() !== "Z") {
    const sign = tz[0] === "-" ? -1 : 1;
    const digits = tz.slice(1).replace(":", "");
    offsetMinutes = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
  }
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss)) -
    offsetMinutes * 60_000;
  if (Number.isNaN(utcMs)) return null;
  return new Date(utcMs + 330 * 60_000).toISOString().slice(0, 19);
}

interface ReportFile {
  id: string | null;
  file_type: string | null;
  file_name: string | null;
  url: string;
}

function safeHttpsUrl(value: unknown): string | null {
  const s = str(value);
  return s && s.toLowerCase().startsWith("https://") ? s : null;
}

/** Only tokenize_public_file_url is customer-safe per Orange's docs; never store file_url. */
function extractReports(reports: unknown): { all: ReportFile[]; primary: ReportFile | null } {
  const list = Array.isArray(reports) ? reports.filter(isObject) : [];
  const all: ReportFile[] = [];
  for (const r of list) {
    const url = safeHttpsUrl(r.tokenize_public_file_url);
    if (!url) continue;
    all.push({ id: str(r.id), file_type: str(r.file_type), file_name: str(r.file_name), url });
  }
  // Prefer the co-branded report, then the standard one; never fall back to the headerless variant.
  const primary =
    all.find((r) => r.file_type === "merged_report_co_bran") ??
    all.find((r) => r.file_type === "merged_report") ??
    all.find((r) => r.file_type !== "merged_report_headerless") ??
    null;
  return { all, primary };
}

interface ParsedEvent {
  eventName: string;
  eventId: string | null;
  requestId: string;
  alnumOrderId: string | null;
  internalOrderId: string | null;
  patientName: string | null;
  slot: string | null;
  totalPrice: number | null;
  paymentStatus: string | null;
  taskId: string | null;
  reports: { all: ReportFile[]; primary: ReportFile | null };
  invoiceUrl: string | null;
  completedOn: string | null;
  completedTest: { id: string | null; name: string | null; completed_at: string | null } | null;
  providerTests: Array<{ name: string | null; fasting_required: boolean; lab_tat_hours: number | null }> | null;
  cancellation: JsonObject | null;
}

function parseEvent(
  eventName: string,
  eventId: string | null,
  requestId: string,
  body: JsonObject,
): ParsedEvent {
  const order = obj(body.order);
  const request = obj(body.request);
  const test = obj(body.test);
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const tests = Array.isArray(body.tests) ? body.tests.filter(isObject) : [];
  const totalPrice = typeof order.total_price === "number" ? order.total_price : null;

  return {
    eventName,
    eventId,
    requestId,
    alnumOrderId: str(order.alnum_order_id),
    internalOrderId: str(order.id),
    patientName: str(obj(order.patient_details).name),
    slot: toIstWallClock(str(request.scheduled_on) ?? str(order.scheduled_on)),
    totalPrice: totalPrice !== null && totalPrice > 0 ? totalPrice : null,
    paymentStatus: mapPaymentStatus(str(obj(body.payment_details).status)),
    taskId: str(obj(tasks[0]).id),
    reports: extractReports(body.reports),
    invoiceUrl: safeHttpsUrl(obj(body.invoice).tokenize_public_file_url),
    completedOn: str(order.completed_on),
    completedTest: isObject(body.test)
      ? { id: str(test.id), name: str(test.test_name), completed_at: str(test.completed_at) }
      : null,
    providerTests: tests.length
      ? tests.map((t) => ({
        name: str(t.test_name),
        fasting_required: Number(t.is_fasting_required) === 1 || t.is_fasting_required === true,
        lab_tat_hours: typeof t.labtat === "number" ? t.labtat : null,
      }))
      : null,
    cancellation: {
      reason: str(request.cancellation_reason),
      explanation: str(request.cancellation_explanation),
      cancelled_on: str(request.cancelled_on),
      refund_amount: typeof request.refund_amount === "number" ? request.refund_amount : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Row targeting and update planning
// ---------------------------------------------------------------------------

interface LabRow {
  id: string;
  status: string | null;
  slot_datetime: string | null;
  payment_status: string | null;
  total_price: number | string | null;
  report_url: string | null;
  report_data: unknown;
  raw_response: unknown;
  orange_order_id: string | null;
  patient_name: string | null;
}

const ROW_COLUMNS =
  "id, status, slot_datetime, payment_status, total_price, report_url, report_data, raw_response, orange_order_id, patient_name";

/**
 * Pick which local rows an event applies to.
 * Request-level events apply to all rows. Patient-level events need an unambiguous match,
 * because attaching one patient's report to another patient's row would be a privacy breach.
 */
function resolveTargets(
  rows: LabRow[],
  rule: EventRule,
  ev: ParsedEvent,
): { targets: LabRow[]; learnOrderId: boolean } {
  if (rule.scope === "request") return { targets: rows, learnOrderId: false };

  const ids = new Set([ev.alnumOrderId, ev.internalOrderId].filter((v): v is string => Boolean(v)));
  const matched = rows.filter((r) => r.orange_order_id && ids.has(String(r.orange_order_id)));
  if (matched.length) return { targets: matched, learnOrderId: false };

  // Rows that don't yet know their Orange order id are candidates. Rows that DO know it but
  // didn't match belong to a different patient order and must not be touched.
  const candidates = rows.filter((r) => !r.orange_order_id);
  if (candidates.length === 1) return { targets: candidates, learnOrderId: true };

  if (candidates.length > 1 && ev.patientName) {
    const wanted = ev.patientName.trim().toLowerCase();
    const byName = candidates.filter((r) => (r.patient_name ?? "").trim().toLowerCase() === wanted);
    if (byName.length === 1) return { targets: byName, learnOrderId: true };
  }
  return { targets: [], learnOrderId: false };
}

interface RowPlan {
  duplicate: boolean;
  update: JsonObject;
  applied: string[];
}

function planRowUpdate(
  row: LabRow,
  rule: EventRule,
  ev: ParsedEvent,
  learnOrderId: boolean,
  nowIso: string,
): RowPlan {
  const oldRaw = obj(row.raw_response);
  const oldWebhook = obj(oldRaw.webhook_state);
  const processedIds = Array.isArray(oldWebhook.processed_event_ids)
    ? oldWebhook.processed_event_ids.filter((x): x is string => typeof x === "string")
    : [];
  if (ev.eventId && processedIds.includes(ev.eventId)) {
    return { duplicate: true, update: {}, applied: [] };
  }

  const currentStatus = (row.status ?? "requested").toLowerCase();
  const currentRank = statusRank(currentStatus);
  const isCancelled = currentRank === statusRank("cancelled");
  const update: JsonObject = {};
  const applied: string[] = [];
  const webhookState: JsonObject = { ...oldWebhook };

  // --- status -------------------------------------------------------------
  if (rule.status && canApplyStatus(currentStatus, rule.status)) {
    update.status = rule.status;
    applied.push("status");
  }

  // --- lifecycle stage (forward-only) ------------------------------------
  const stageAllowed = rule.stage === "cancelled"
    ? !isCancelled && canApplyStatus(currentStatus, "cancelled")
    : !isCancelled && stageRank(rule.stage) >= stageRank(oldWebhook.lifecycle_stage);
  if (stageAllowed) {
    webhookState.lifecycle_stage = rule.stage;
    applied.push("stage");
  }

  // --- slot: only before a medic is assigned (status alone stays "scheduled" until collection,
  // so the lifecycle stage is checked as well; a stale task.confirmed must not move the slot) ----
  if (
    rule.updateSlot && ev.slot &&
    currentRank <= statusRank("cancellation_pending") &&
    stageRank(oldWebhook.lifecycle_stage) <= STAGE_RANK.scheduled
  ) {
    update.slot_datetime = ev.slot;
    applied.push("slot");
  }

  // --- payment / price ----------------------------------------------------
  if (ev.paymentStatus) {
    const currentPayment = (row.payment_status ?? "pending").toLowerCase();
    const currentPaymentRank = PAYMENT_RANK[currentPayment] ?? 1;
    const nextPaymentRank = PAYMENT_RANK[ev.paymentStatus] ?? 1;
    if (nextPaymentRank >= currentPaymentRank && ev.paymentStatus !== currentPayment) {
      update.payment_status = ev.paymentStatus;
      applied.push("payment");
    }
  }
  if (ev.totalPrice !== null && Number(row.total_price ?? 0) !== ev.totalPrice) {
    update.total_price = ev.totalPrice;
    applied.push("price");
  }

  // --- reports ------------------------------------------------------------
  const oldReportData = obj(row.report_data);
  if (rule.reports === "final" && !isCancelled) {
    update.report_data = {
      ...oldReportData,
      source: "webhook",
      is_partial: false,
      completed_on: ev.completedOn,
      primary_report: ev.reports.primary,
      reports: ev.reports.all,
      invoice_url: ev.invoiceUrl,
      updated_at: nowIso,
    };
    if (ev.reports.primary) update.report_url = ev.reports.primary.url;
    applied.push(ev.reports.primary ? "report" : "report_missing_url");
  } else if (rule.reports === "partial" && currentRank < statusRank("completed")) {
    // Partial reports never touch report_url; they only record that something is available.
    const earlier = Array.isArray(oldReportData.completed_tests) ? oldReportData.completed_tests : [];
    const already = ev.completedTest?.id
      ? earlier.some((t) => isObject(t) && t.id === ev.completedTest!.id)
      : false;
    update.report_data = {
      ...oldReportData,
      source: "webhook",
      is_partial: true,
      partial_report: ev.reports.primary,
      completed_tests: ev.completedTest && !already ? [...earlier, ev.completedTest].slice(-50) : earlier,
      updated_at: nowIso,
    };
    applied.push("partial_report");
  }

  // --- other captured details --------------------------------------------
  if (rule.captureTests && ev.providerTests) {
    webhookState.provider_tests = ev.providerTests;
    applied.push("tests_info");
  }
  if (rule.captureCancellation && update.status === "cancelled" && ev.cancellation) {
    webhookState.cancellation = ev.cancellation;
    applied.push("cancellation");
  }
  if (ev.taskId && ev.eventName === "task.confirmed") webhookState.task_id = ev.taskId;
  if (learnOrderId && ev.alnumOrderId) {
    update.orange_order_id = ev.alnumOrderId;
    applied.push("order_id");
  }

  // --- bookkeeping --------------------------------------------------------
  const oldEvents = Array.isArray(oldWebhook.recent_events) ? oldWebhook.recent_events : [];
  webhookState.latest_event = ev.eventName;
  webhookState.latest_event_id = ev.eventId;
  webhookState.latest_event_at = nowIso;
  webhookState.recent_events = [
    ...oldEvents.slice(-9),
    { event: ev.eventName, event_id: ev.eventId, received_at: nowIso, applied },
  ];
  webhookState.processed_event_ids = ev.eventId ? [...processedIds.slice(-49), ev.eventId] : processedIds;

  update.raw_response = { ...oldRaw, webhook_state: webhookState };
  update.updated_at = nowIso;
  return { duplicate: false, update, applied };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function fetchRows(client: any, requestId: string): Promise<{ rows: LabRow[]; error: string | null }> {
  const { data, error } = await client.from("lab_orders").select(ROW_COLUMNS).eq("city_request_id", requestId);
  if (error) return { rows: [], error: String(error.message ?? error) };
  return { rows: (data ?? []) as LabRow[], error: null };
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const secret = Deno.env.get("ORANGE_WEBHOOK_SECRET");
    if (!secret) {
      console.error("ORANGE_WEBHOOK_SECRET is not configured");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const signature = (req.headers.get("x-oh-signature") ?? "").trim();
    const eventId = str(req.headers.get("x-oh-event-id"));
    const rawBody = await req.text();

    if (!signature) {
      console.error("Orange webhook missing signature", { eventIdPresent: Boolean(eventId) });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    if (!(await signatureMatches(secret, rawBody, signature))) {
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

    // From here on the request is authentic. Unknown/unusable events get a 200 so Orange does not retry.
    const eventName = getEventName(payload, req.headers);
    if (!eventName) {
      console.warn("Verified Orange webhook had no event name", { topLevelKeys: Object.keys(payload) });
      return jsonResponse({ success: true, processed: false, reason: "Event name not found in payload" });
    }
    const rule = EVENT_RULES[eventName];
    if (!rule) {
      console.log("Ignoring unhandled Orange webhook event", { eventName });
      return jsonResponse({ success: true, processed: false, reason: "Event not handled", event: eventName });
    }

    const body = unwrapBody(payload);
    const requestId = getRequestId(payload, body);
    if (!requestId) {
      console.warn("Verified Orange webhook has no city_request_id", { eventName, bodyKeys: Object.keys(body) });
      return jsonResponse({ success: true, processed: false, reason: "Request ID not found", event: eventName });
    }
    const ev = parseEvent(eventName, eventId, requestId, body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase service environment is not configured");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let { rows, error: selectError } = await fetchRows(serviceClient, requestId);
    if (selectError) {
      console.error("Failed to look up local bookings", { eventName, requestId, error: selectError });
      return jsonResponse({ error: "Could not find local booking records" }, 500);
    }
    if (rows.length === 0) {
      // Orange can fire order.created before create-order has finished inserting the local row.
      await sleep(2000);
      ({ rows, error: selectError } = await fetchRows(serviceClient, requestId));
      if (selectError) {
        console.error("Failed to look up local bookings (retry)", { eventName, requestId, error: selectError });
        return jsonResponse({ error: "Could not find local booking records" }, 500);
      }
    }
    if (rows.length === 0) {
      console.warn("No local booking matched Orange webhook", { eventName, requestId });
      return jsonResponse({ success: true, processed: false, reason: "No matching local booking", event: eventName });
    }

    const { targets, learnOrderId } = resolveTargets(rows, rule, ev);
    if (targets.length === 0) {
      console.warn("Orange webhook could not be tied to a single local patient order; skipped", {
        eventName,
        requestId,
        localRows: rows.length,
      });
      return jsonResponse({
        success: true,
        processed: false,
        reason: "Could not identify the matching patient order",
        event: eventName,
      });
    }

    const nowIso = new Date().toISOString();
    let updatedCount = 0;
    let duplicateCount = 0;
    const appliedAll = new Set<string>();

    for (const row of targets) {
      const plan = planRowUpdate(row, rule, ev, learnOrderId, nowIso);
      if (plan.duplicate) {
        duplicateCount++;
        continue;
      }
      const { error: updateError } = await serviceClient.from("lab_orders").update(plan.update).eq("id", row.id);
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
      plan.applied.forEach((a) => appliedAll.add(a));
    }

    if (duplicateCount === targets.length) {
      console.log("Orange webhook duplicate ignored", { eventName, requestId });
      return jsonResponse({ success: true, processed: false, duplicate: true, event: eventName });
    }

    console.log("Orange webhook processed", {
      eventName,
      requestId,
      updatedCount,
      duplicateCount,
      applied: [...appliedAll],
    });
    return jsonResponse({
      success: true,
      processed: true,
      event: eventName,
      updatedCount,
      applied: [...appliedAll],
    });
  } catch (error) {
    console.error("Error processing Orange webhook", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse({ error: "Internal Server Error" }, 500);
  }
}

serve(handleRequest);
