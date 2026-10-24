/**
 * Pure helpers for OrangeLabTests.tsx.
 * No React or Supabase imports on purpose, so everything here can be unit-tested in isolation.
 *
 * Slot strings are IST wall-clock values ("YYYY-MM-DDTHH:mm:ss"), exactly as Orange returns them
 * and as the backend stores them. Comparisons never use the device time zone.
 */

// ---------------------------------------------------------------------------
// Errors coming back from the orange-health edge function
// ---------------------------------------------------------------------------

/**
 * Backend error contract: { success:false, code, error, message, available_slots?, provider_status? }.
 * `error` / `message` are already short, user-safe sentences.
 */
export class OrangeHealthError extends Error {
  code?: string;
  availableSlots?: string[];

  constructor(message: string, code?: string, availableSlots?: string[]) {
    super(message);
    Object.setPrototypeOf(this, OrangeHealthError.prototype);
    this.name = "OrangeHealthError";
    this.code = code;
    this.availableSlots = availableSlots;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstText(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function parseInvokeFailure(
  payload: unknown,
  fallback: string,
): { message: string; code?: string; availableSlots?: string[] } {
  const body = isRecord(payload) ? payload : {};
  const details = isRecord(body.details) ? body.details : {};
  const message = firstText([body.error, body.message, details.status, details.message]) ?? fallback;
  const code = typeof body.code === "string" ? body.code : undefined;
  const availableSlots = Array.isArray(body.available_slots)
    ? body.available_slots.filter((s): s is string => typeof s === "string")
    : undefined;
  return { message, code, availableSlots };
}

/** Error codes that mean "this booking can no longer be changed"; the UI should refresh and hide the buttons. */
export const BOOKING_LOCKED_CODES = new Set([
  "medic_assigned",
  "not_changeable",
  "already_cancelled",
  "cancellation_in_progress",
  "slot_passed",
]);

/** Error codes that mean "pick a different slot". */
export const SLOT_PROBLEM_CODES = new Set(["slot_unavailable", "slot_in_past", "invalid_slot", "same_slot"]);

// ---------------------------------------------------------------------------
// IST slot helpers
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 330 * 60_000;

export function istNowWallClock(now = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 19);
}

export function istToday(now = Date.now()): string {
  return istNowWallClock(now).slice(0, 10);
}

/**
 * Normalises "2026-02-17T15:05", "2026-02-17T15:05:00" and "2026-02-17T15:05:00+00:00"
 * (what Postgres returns) to "2026-02-17T15:05:00". The digits are the IST wall clock.
 */
export function toSlotKey(value?: string | null): string | null {
  const m = typeof value === "string"
    ? value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/)
    : null;
  return m ? `${m[1]}T${m[2]}:${m[3] ?? "00"}` : null;
}

export function slotPeriod(slot: string): "Morning" | "Afternoon" | "Evening" {
  const hour = Number(slot.slice(11, 13));
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

// ---------------------------------------------------------------------------
// Booking state: what can still be changed, and how to label it
// ---------------------------------------------------------------------------

export interface OrderLike {
  status?: string | null;
  city_request_id?: string | null;
  slot_datetime?: string | null;
  report_url?: string | null;
  report_data?: unknown;
  raw_response?: unknown;
}

/** Lifecycle stages (set by the orange-webhook function) after which Orange no longer allows changes. */
export const MEDIC_STAGES = new Set([
  "phlebo_assigned",
  "phlebo_accepted",
  "emedic_on_the_way",
  "collection_in_progress",
  "sample_collected",
  "partial_report_available",
  "report_ready",
]);

const NON_MANAGEABLE_STATUSES = new Set([
  "cancelled",
  "canceled",
  "completed",
  "sample_collected",
  "cancellation_pending",
  "cancelled_pending",
  "reschedule_pending",
]);

function normalizedStatus(order: OrderLike): string {
  return (order.status || "").toLowerCase().replace(/[ -]/g, "_");
}

export function getLifecycleStage(order: OrderLike): string | null {
  const raw = isRecord(order.raw_response) ? order.raw_response : null;
  const state = raw && isRecord(raw.webhook_state) ? raw.webhook_state : null;
  return state && typeof state.lifecycle_stage === "string" ? state.lifecycle_stage : null;
}

export function isSlotPassed(order: OrderLike, now = Date.now()): boolean {
  const key = toSlotKey(order.slot_datetime);
  return key !== null && key <= istNowWallClock(now);
}

export function canManageOrder(order: OrderLike, pending: PendingMap): boolean {
  const requestId = order.city_request_id || "";
  if (!requestId || pending[requestId]) return false;
  if (NON_MANAGEABLE_STATUSES.has(normalizedStatus(order))) return false;
  const stage = getLifecycleStage(order);
  return !(stage && MEDIC_STAGES.has(stage));
}

/** Rescheduling additionally needs a slot that hasn't passed (cancelling a no-show is left to Orange). */
export function canRescheduleOrder(order: OrderLike, pending: PendingMap, now = Date.now()): boolean {
  return canManageOrder(order, pending) && !isSlotPassed(order, now);
}

export type StatusTone = "green" | "red" | "orange";

const STAGE_LABELS: Record<string, string> = {
  phlebo_assigned: "Phlebotomist assigned",
  phlebo_accepted: "Phlebotomist assigned",
  emedic_on_the_way: "Phlebotomist on the way",
  collection_in_progress: "Sample collection in progress",
  sample_collected: "Sample collected",
  partial_report_available: "Partial report available",
  report_ready: "Report ready",
};

function titleCase(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Requested";
}

export function getOrderDisplay(order: OrderLike, pending: PendingMap): { label: string; tone: StatusTone } {
  const requestId = order.city_request_id || "";
  const pendingEntry = requestId ? pending[requestId] : undefined;
  if (pendingEntry?.kind === "cancel") return { label: "Cancellation pending", tone: "orange" };
  if (pendingEntry?.kind === "reschedule") return { label: "Reschedule pending", tone: "orange" };

  const status = normalizedStatus(order);
  if (status === "cancelled" || status === "canceled") return { label: "Cancelled", tone: "red" };
  if (status === "completed") {
    return { label: order.report_url ? "Report ready" : "Completed", tone: "green" };
  }
  const stage = getLifecycleStage(order);
  if (stage && STAGE_LABELS[stage]) return { label: STAGE_LABELS[stage], tone: "orange" };
  if (status === "sample_collected") return { label: "Sample collected", tone: "orange" };
  return { label: titleCase(status || "requested"), tone: "orange" };
}

/** Partial reports (test.completed_sent) are stored in report_data and never in report_url. */
export function getPartialReportUrl(order: OrderLike): string | null {
  const data = isRecord(order.report_data) ? order.report_data : null;
  if (!data || data.is_partial !== true) return null;
  const partial = isRecord(data.partial_report) ? data.partial_report : null;
  const url = partial && typeof partial.url === "string" ? partial.url : null;
  return url && url.toLowerCase().startsWith("https://") ? url : null;
}

// ---------------------------------------------------------------------------
// "Pending" markers (cancel / reschedule accepted, awaiting Orange's webhook)
// ---------------------------------------------------------------------------

export type PendingKind = "cancel" | "reschedule";

export interface PendingEntry {
  kind: PendingKind;
  /** For reschedules: the slot shown when the request was made. A different stored slot means it was confirmed. */
  slot?: string;
  /** Epoch ms when the request was accepted. */
  at: number;
}

export type PendingMap = Record<string, PendingEntry>;

/**
 * Markers expire so a lost webhook can never leave a booking stuck without its buttons forever.
 */
export const PENDING_TTL_MS = 12 * 60 * 60 * 1000;

export function parsePendingStorage(raw: string | null, now = Date.now()): PendingMap {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isRecord(parsed)) return {};

  const out: PendingMap = {};
  for (const [requestId, entry] of Object.entries(parsed)) {
    if (!isRecord(entry)) continue;
    const { kind, at, slot } = entry;
    if ((kind !== "cancel" && kind !== "reschedule") || typeof at !== "number" || !Number.isFinite(at)) continue;
    if (now - at > PENDING_TTL_MS || at > now + 60_000) continue; // expired, or a timestamp from the future
    out[requestId] = { kind, at, ...(typeof slot === "string" ? { slot } : {}) };
  }
  return out;
}

export function removePending(pending: PendingMap, requestId: string): PendingMap {
  if (!(requestId in pending)) return pending;
  const next = { ...pending };
  delete next[requestId];
  return next;
}

/**
 * Drops markers that are expired or already resolved by what the database now says.
 * Returns the SAME object when nothing changed.
 */
export function reconcilePending(pending: PendingMap, orders: OrderLike[], now = Date.now()): PendingMap {
  let next = pending;
  for (const [requestId, entry] of Object.entries(pending)) {
    let drop = now - entry.at > PENDING_TTL_MS;
    if (!drop) {
      const matching = orders.filter((o) => (o.city_request_id || "") === requestId);
      if (entry.kind === "cancel") {
        drop = matching.some((o) => ["cancelled", "canceled"].includes(normalizedStatus(o)));
      } else {
        drop = matching.some((o) => {
          const status = normalizedStatus(o);
          const settled = ["cancelled", "canceled", "completed", "sample_collected"].includes(status);
          const slotChanged = entry.slot !== undefined && toSlotKey(o.slot_datetime) !== toSlotKey(entry.slot);
          return settled || slotChanged;
        });
      }
    }
    if (drop) next = removePending(next, requestId);
  }
  return next;
}
