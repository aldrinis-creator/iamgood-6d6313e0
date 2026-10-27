import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Orange Health Labs partner integration (user-facing actions).
 *
 *   serviceability   GET  /v1/partner/serviceability   address + request_date ONLY
 *   create-order     POST /v1/partner/order
 *   cancel-order     PATCH /v1/partner/{request_id}/cancel?token=
 *   reschedule-order PATCH /v1/partner/{request_id}/reschedule?token=
 *
 * Reports are NOT fetched from here: Orange pushes them per order through the documented order.completed webhook
 * (see orange-webhook). A lookup by phone number could attach the wrong person's report, so it was removed.
 *
 * Error contract (every failure):
 *   { success:false, code, error, message, provider_status?, provider_message?, details? }
 *   `error` and `message` both hold a short, user-safe sentence, so clients that only read
 *   `error` (or `details.message`) show the right text.
 *
 * Slot times are IST wall-clock strings ("YYYY-MM-DDTHH:mm:ss"), exactly as Orange returns them
 * and as the app stores/displays them.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sandbox by default. Set ORANGE_HEALTH_BASE_URL (https only) to switch to production.
const BASE_URL = (() => {
  const configured = Deno.env.get("ORANGE_HEALTH_BASE_URL")?.trim();
  const url = configured && /^https:\/\//i.test(configured)
    ? configured
    : "https://sandbox-partner-api.orangehealth.dev";
  return url.replace(/\/+$/, "");
})();

const PROVIDER_TIMEOUT_MS = 20_000;
const IST_OFFSET_MS = 330 * 60_000;

// deno-lint-ignore no-explicit-any
type JsonObject = Record<string, any>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

function jsonResponse(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, code: string, message: string, extra: JsonObject = {}) {
  return jsonResponse({ success: false, code, error: message, message, ...extra }, status);
}

function isObj(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

async function readJson(response: Response): Promise<JsonObject> {
  if (response.status === 204) return {};
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return isObj(parsed) ? parsed : { data: parsed };
  } catch {
    return { message: text };
  }
}

// ---------------------------------------------------------------------------
// Dates and slots (all IST wall-clock)
// ---------------------------------------------------------------------------

function istNowWallClock(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 19);
}

function istToday(): string {
  return istNowWallClock().slice(0, 10);
}

function validDate(value: unknown): value is string {
  const m = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Accepts YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss and always returns YYYY-MM-DDTHH:mm:ss. */
function normalizeSlot(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, date, hh, mm, ss = "00"] = m;
  if (!validDate(date) || Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return null;
  return `${date}T${hh}:${mm}:${ss}`;
}

/** lab_orders.slot_datetime comes back as "2026-02-17T15:05:00+00:00"; the digits are the IST wall clock. */
function slotFromDb(value: unknown): string | null {
  const m = typeof value === "string" ? value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/) : null;
  return m ? `${m[1]}T${m[2]}` : null;
}

function cleanPhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
}

function getLocation(latitude: unknown, longitude: unknown) {
  const lat = latitude === null || latitude === undefined || latitude === "" ? null : Number(latitude);
  const lng = longitude === null || longitude === undefined || longitude === "" ? null : Number(longitude);
  if (lat === null && lng === null) return null;
  if (
    lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    throw new Error("Both valid latitude and longitude are required when coordinates are provided.");
  }
  return { latitude: String(lat), longitude: String(lng) };
}

function cleanAddress(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// ---------------------------------------------------------------------------
// Provider access
// ---------------------------------------------------------------------------

class ProviderUnreachableError extends Error {}

/** Calls Orange with the api_key header and a timeout. Throws ProviderUnreachableError on network failure. */
async function orangeFetch(
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<{ response: Response; data: JsonObject }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), api_key: apiKey },
      signal: controller.signal,
    });
    const data = await readJson(response);
    if (!response.ok) {
      // Diagnostics for support: method, path WITHOUT the query string (which holds the token / address), status, body.
      console.warn("Orange Health non-OK response", {
        method: init.method ?? "GET",
        path: path.split("?")[0],
        status: response.status,
        body: JSON.stringify(data).slice(0, 300),
      });
    }
    return { response, data };
  } catch (error) {
    throw new ProviderUnreachableError(error instanceof Error ? error.message : "Provider unreachable");
  } finally {
    clearTimeout(timer);
  }
}

/** Orange puts its message in `status` (string, or {status:string}); some errors use message/error. */
function providerMessage(data: JsonObject): string | null {
  const s = data.status;
  if (typeof s === "string" && s.trim()) return s.trim();
  if (isObj(s) && typeof s.status === "string" && s.status.trim()) return s.status.trim();
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  return null;
}

/** Create-order 400s carry { error: { "CreateOrderStruct.Field": "Field Can Not Be Empty" } }. */
function providerFieldMessages(data: JsonObject): string[] {
  if (!isObj(data.error)) return [];
  return Object.values(data.error)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

const KNOWN_PROVIDER_ISSUES: Array<{ match: RegExp; code: string; message: string; status?: number }> = [
  {
    match: /cannot (cancel|reschedule) after medic/i,
    code: "medic_assigned",
    message:
      "A phlebotomist has already been assigned, so this booking can no longer be changed online. Please contact support if you need help.",
  },
  {
    // Seen from Orange's sandbox: {"error":"Task with request with id 345965 not found"} when rescheduling. The request
    // exists (cancel works) but has no task yet, i.e. Orange hasn't finished confirming it. This is temporary, not final.
    match: /task\b.*\bnot found/i,
    code: "task_not_ready",
    status: 409,
    message:
      "This booking can't be changed yet because Orange Health hasn't finished setting it up. Please try again a little later, or contact support.",
  },
  {
    match: /slot is not available/i,
    code: "slot_unavailable",
    message: "That time slot is no longer available. Please pick another slot.",
  },
  { match: /invalid slot/i, code: "invalid_slot", message: "That time slot isn't valid. Please pick another slot." },
  {
    match: /invalid (or expired )?token/i,
    code: "invalid_token",
    message: "This booking can't be changed online right now. Please contact support.",
  },
  {
    match: /unable to geocode/i,
    code: "address_not_found",
    message:
      "We couldn't locate that address. Please enter a more complete address (house/flat, area, city and pincode).",
  },
  {
    match: /latitude|longitude|pincode/i,
    code: "address_check_unavailable",
    message:
      "We couldn't check slots for that address right now. Please try again in a moment, or contact support if it keeps happening.",
  },
  { match: /past or invalid date/i, code: "invalid_date", message: "Please choose today or a future date." },
  {
    match: /already accepted/i,
    code: "duplicate_request",
    message: "Orange Health already accepted this request. Please check My Bookings before booking again.",
  },
  {
    match: /mandatory parameters are missing/i,
    code: "missing_fields",
    message: "Some booking details are missing or invalid.",
  },
];

/**
 * Turns a non-2xx Orange response into our error contract.
 *  - 401/403: OUR credentials were rejected. Returned as 502 so the app never mistakes it for the
 *    user's own session expiring.
 *  - 5xx: provider outage -> 502.
 *  - other 4xx: keep the status, translate known messages, otherwise surface Orange's own text.
 */
function providerFailure(response: Response, data: JsonObject, fallback: string) {
  const status = response.status;
  if (status === 401 || status === 403) {
    console.error(
      `Orange Health rejected our credentials (HTTP ${status}). Check ORANGE_HEALTH_API_KEY and ORANGE_HEALTH_BASE_URL.`,
    );
    return fail(
      502,
      "provider_auth_failed",
      "The lab booking service is temporarily unavailable. Please try again later.",
      { provider_status: status },
    );
  }
  if (status === 429) {
    return fail(429, "rate_limited", "Too many requests. Please wait a moment and try again.", {
      provider_status: status,
    });
  }

  const raw = providerMessage(data);
  const fields = providerFieldMessages(data);
  const known = KNOWN_PROVIDER_ISSUES.find((k) => k.match.test(raw ?? ""));

  // Messages we recognise are translated whatever the HTTP status Orange used (some arrive as 400, some as 5xx).
  if (known) {
    const message = known.code === "missing_fields" && fields.length ? fields.join(". ") : known.message;
    return fail(known.status ?? (status >= 500 ? 502 : status), known.code, message, {
      provider_status: status,
      provider_message: raw,
      details: data,
    });
  }
  if (status >= 500) {
    console.error("Orange Health server error", { providerStatus: status });
    return fail(
      502,
      "provider_error",
      "The lab booking service is having trouble right now. Please try again in a few minutes.",
      { provider_status: status, provider_message: raw },
    );
  }
  if (status === 404) {
    // Unrecognised 404 (e.g. plain "404 page not found"): the booking/route isn't known to Orange. Don't show raw text.
    return fail(
      404,
      "provider_not_found",
      "Orange Health couldn't find this request. Please contact support with your booking reference.",
      { provider_status: 404, provider_message: raw },
    );
  }
  return fail(status, "provider_rejected", fields.length ? fields.join(". ") : (raw ?? fallback), {
    provider_status: status,
    provider_message: raw,
    details: data,
  });
}

function providerUnreachable(ambiguous = false) {
  if (ambiguous) {
    return fail(
      504,
      "provider_timeout",
      "We couldn't confirm whether your booking went through. Please check My Bookings before trying again.",
    );
  }
  return fail(502, "provider_unreachable", "Could not reach the lab booking service. Please try again shortly.");
}

// ---------------------------------------------------------------------------
// Serviceability / slot availability (address based only)
// ---------------------------------------------------------------------------

function extractSlots(data: JsonObject): string[] {
  const map = isObj(data.slots) ? data.slots : {};
  const out = new Set<string>();
  for (const [key, value] of Object.entries(map)) {
    const candidate = isObj(value) && typeof value.slot_datetime === "string" ? value.slot_datetime : key;
    const slot = normalizeSlot(candidate);
    if (slot) out.add(slot);
  }
  return [...out].sort();
}

async function lookupSlots(apiKey: string, address: string, requestDate: string) {
  // Same encoding as Orange's documented cURL (spaces as %20, commas as %2C), not URLSearchParams' '+'.
  const query = `request_date=${encodeURIComponent(requestDate)}&address=${encodeURIComponent(address)}`;
  const { response, data } = await orangeFetch(`/v1/partner/serviceability?${query}`, apiKey);
  return { response, data, slots: response.ok ? extractSlots(data) : [] };
}

/**
 * Re-checks that `slot` is still offered for `address`. Availability can change between the user
 * picking a slot and submitting. Fails OPEN (available:null) if Orange can't answer, so a flaky
 * lookup never blocks a booking that Orange itself would accept.
 */
async function checkSlotAvailability(
  apiKey: string,
  address: string,
  slot: string,
): Promise<{ available: boolean | null; slots: string[] }> {
  try {
    const lookup = await lookupSlots(apiKey, address, slot.slice(0, 10));
    if (!lookup.response.ok || !isObj(lookup.data.slots)) return { available: null, slots: [] };
    return { available: lookup.slots.includes(slot), slots: lookup.slots };
  } catch {
    return { available: null, slots: [] };
  }
}

// ---------------------------------------------------------------------------
// Can this booking still be cancelled / rescheduled?
// ---------------------------------------------------------------------------

const MEDIC_STAGES = new Set([
  "phlebo_assigned",
  "phlebo_accepted",
  "emedic_on_the_way",
  "collection_in_progress",
  "sample_collected",
  "partial_report_available",
  "report_ready",
]);

interface ManageBlock {
  status: number;
  code: string;
  message: string;
}

/**
 * Local pre-check using what the webhook has told us. Orange stays the authority (the ~45 minute
 * "medic assigned" cut-off is enforced by Orange and translated by providerFailure); this only blocks
 * cases we already KNOW are final, so the user gets a clear answer without a pointless API call.
 */
function manageBlock(rows: JsonObject[], verb: "cancel" | "reschedule"): ManageBlock | null {
  const statuses = rows.map((r) => String(r.status ?? "").toLowerCase());

  if (statuses.every((s) => s === "cancelled" || s === "canceled")) {
    return { status: 409, code: "already_cancelled", message: "This booking is already cancelled." };
  }
  if (statuses.some((s) => s === "completed" || s === "sample_collected")) {
    return {
      status: 409,
      code: "not_changeable",
      message: "The sample has already been collected, so this booking can no longer be changed.",
    };
  }
  if (verb === "reschedule" && statuses.some((s) => s === "cancellation_pending" || s === "cancelled_pending")) {
    return {
      status: 409,
      code: "cancellation_in_progress",
      message: "A cancellation is already in progress for this booking.",
    };
  }
  const stages = rows.map((r) => r.raw_response?.webhook_state?.lifecycle_stage);
  if (stages.some((s) => typeof s === "string" && MEDIC_STAGES.has(s))) {
    return {
      status: 409,
      code: "medic_assigned",
      message:
        "A phlebotomist has already been assigned, so this booking can no longer be changed online. Please contact support if you need help.",
    };
  }
  // A passed slot only blocks rescheduling. Cancelling a no-show is left to Orange to decide.
  if (verb === "reschedule") {
    const slot = slotFromDb(rows.find((r) => r.slot_datetime)?.slot_datetime);
    if (slot && slot <= istNowWallClock()) {
      return { status: 409, code: "slot_passed", message: "The scheduled time for this booking has already passed." };
    }
  }
  return null;
}

function cleanIds(list: unknown, key: "test_id" | "package_id"): string[] | null {
  const items = Array.isArray(list) ? list : [];
  const ids: string[] = [];
  for (const item of items) {
    const id = isObj(item) ? str(item[key]) : null;
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || /^(undefined|null)$/i.test(id)) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Method not allowed");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail(401, "unauthorized", "Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Required Supabase environment variables are missing.");
      return fail(500, "server_misconfigured", "Server configuration error");
    }

    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return fail(401, "unauthorized", "Unauthorized");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail(400, "invalid_request", "A valid JSON body is required");
    const { action } = body;

    const providerActions = ["serviceability", "create-order", "cancel-order", "reschedule-order"];
    if (!providerActions.includes(action)) return fail(400, "invalid_action", "Invalid action");

    const apiKey = Deno.env.get("ORANGE_HEALTH_API_KEY");
    if (!apiKey) {
      console.error("ORANGE_HEALTH_API_KEY Supabase secret is not configured.");
      return fail(500, "server_misconfigured", "Orange Health API key is not configured on the server");
    }
    console.log("orange-health action:", action);

    // -----------------------------------------------------------------------
    // serviceability: address + request_date only. Anything else in the body is ignored.
    // -----------------------------------------------------------------------
    if (action === "serviceability") {
      const requestDate = body.request_date;
      const address = cleanAddress(body.address);

      if (!validDate(requestDate)) return fail(400, "invalid_date", "Please choose a valid date.");
      if (requestDate < istToday()) return fail(400, "invalid_date", "Please choose today or a future date.");
      if (!address) return fail(400, "address_required", "Please enter the full collection address.");
      if (address.length > 500) return fail(400, "address_too_long", "That address is too long. Please shorten it.");

      const lookup = await lookupSlots(apiKey, address, requestDate);
      if (!lookup.response.ok) {
        return providerFailure(lookup.response, lookup.data, "Could not check availability for this address.");
      }
      return jsonResponse({
        status: lookup.response.status,
        data: lookup.data, // Orange's response, untouched ({ slots, status })
        serviceable: lookup.slots.length > 0,
        available_slots: lookup.slots,
      });
    }

    // -----------------------------------------------------------------------
    // create-order
    // -----------------------------------------------------------------------
    if (action === "create-order") {
      const address = cleanAddress(body.address);
      const primaryName = typeof body.primary_patient_name === "string" ? body.primary_patient_name.trim() : "";
      const primaryPhone = cleanPhone(body.primary_patient_number);
      const slotDateTime = normalizeSlot(body.slot_datetime);
      const patientDetails = body.patient_details;
      // Who pays is a BUSINESS decision, so the server decides, never the client (otherwise any caller could send
      // "paid_by_group" and have Check-iN billed). Default: the patient pays. To test Orange's "paid_by_group" flow,
      // set the ORANGE_HEALTH_PAYMENT_TYPE function secret to paid_by_group.
      const paymentType = Deno.env.get("ORANGE_HEALTH_PAYMENT_TYPE")?.trim() === "paid_by_group"
        ? "paid_by_group"
        : "paid_by_patient";

      if (!address || !primaryName || primaryPhone.length !== 10 || !Array.isArray(patientDetails) || patientDetails.length === 0) {
        return fail(
          400,
          "invalid_request",
          "Missing or invalid booking details. Address, patient name, a 10-digit phone number and patient details are required.",
        );
      }
      if (address.length > 500) return fail(400, "address_too_long", "That address is too long. Please shorten it.");
      if (!slotDateTime) return fail(400, "invalid_slot", "Please select a valid collection time slot.");
      if (slotDateTime <= istNowWallClock()) {
        return fail(400, "slot_in_past", "That time slot has already passed. Please pick another slot.");
      }

      const normalizedPatients: JsonObject[] = [];
      for (const patient of patientDetails) {
        const name = typeof patient?.patient_name === "string" ? patient.patient_name.trim() : "";
        const age = String(patient?.age ?? "").trim();
        const gender = String(patient?.gender ?? "").toLowerCase();
        const testIds = cleanIds(patient?.tests, "test_id");
        const packageIds = cleanIds(patient?.packages, "package_id");

        if (!name || !/^\d{1,3}$/.test(age) || Number(age) > 120 || !["male", "female", "other"].includes(gender)) {
          return fail(400, "invalid_patient", "Each patient needs a name, a valid age and a valid gender.");
        }
        if (testIds === null || packageIds === null) {
          return fail(400, "invalid_tests", "One of the selected tests or packages is invalid. Please reselect and try again.");
        }
        if (!testIds.length && !packageIds.length) {
          return fail(400, "invalid_tests", "Please select at least one test or package.");
        }
        normalizedPatients.push({
          ...(patient.partner_reference_id ? { partner_reference_id: String(patient.partner_reference_id) } : {}),
          patient_name: name,
          ...(patient.patient_phone ? { patient_phone: cleanPhone(patient.patient_phone) } : {}),
          age: String(Number(age)),
          gender,
          // Tests and packages are separate lists in Orange's API; never mix their ids.
          ...(testIds.length ? { tests: testIds.map((test_id) => ({ test_id })) } : {}),
          ...(packageIds.length ? { packages: packageIds.map((package_id) => ({ package_id })) } : {}),
        });
      }

      let location: { latitude: string; longitude: string } | null;
      try {
        location = getLocation(body.latitude, body.longitude);
      } catch (error) {
        return fail(400, "invalid_request", error instanceof Error ? error.message : "Invalid coordinates");
      }

      // Availability can change after the user picked the slot; re-check against the same address.
      const availability = await checkSlotAvailability(apiKey, address, slotDateTime);
      if (availability.available === false) {
        return fail(409, "slot_unavailable", "That time slot is no longer available. Please pick another slot.", {
          available_slots: availability.slots,
        });
      }

      const orangePayload: JsonObject = {
        address,
        ...(location ? { location } : {}),
        primary_patient_name: primaryName,
        primary_patient_number: primaryPhone,
        slot_datetime: slotDateTime,
        payment_type: paymentType,
        ...(typeof body.partner_notes === "string" && body.partner_notes.trim()
          ? { partner_notes: body.partner_notes.trim() }
          : {}),
        patient_details: normalizedPatients,
      };

      // Never log patient names, phone numbers, addresses, or other booking details.
      console.log("Orange Health create-order request prepared", {
        patientCount: normalizedPatients.length,
        hasLocation: Boolean(location),
        hasPartnerNotes: Boolean(orangePayload.partner_notes),
        slotChecked: availability.available === true,
      });

      let providerResult: { response: Response; data: JsonObject };
      try {
        providerResult = await orangeFetch("/v1/partner/order", apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orangePayload),
        });
      } catch {
        // The request may or may not have reached Orange. Do NOT tell the user to simply retry.
        return providerUnreachable(true);
      }
      const { response, data: providerData } = providerResult;

      // 425 = duplicate within 60 seconds. No local row and no "confirmed" claim.
      if (!response.ok) return providerFailure(response, providerData, "Failed to create order with Orange Health");

      if (!providerData.request_id || !providerData.token) {
        console.error("Orange Health accepted the booking but request_id/token is missing from the response");
      }

      const firstProviderOrder = Array.isArray(providerData.orders) ? providerData.orders[0] : null;
      const firstPatient = normalizedPatients[0];
      const clientTests = Array.isArray(body.selected_tests) ? body.selected_tests : [];
      const storedTests = clientTests.length
        ? clientTests
        : [
          ...(firstPatient.tests || []).map((t: JsonObject) => ({ test_id: t.test_id })),
          ...(firstPatient.packages || []).map((p: JsonObject) => ({ package_id: p.package_id })),
        ];

      const { data: dbOrder, error: dbError } = await serviceClient
        .from("lab_orders")
        .insert({
          user_id: user.id,
          orange_order_id: firstProviderOrder?.alnumOrderId != null
            ? String(firstProviderOrder.alnumOrderId)
            : firstProviderOrder?.id != null
            ? String(firstProviderOrder.id)
            : null,
          city_request_id: providerData.request_id != null ? String(providerData.request_id) : null,
          patient_name: primaryName,
          patient_phone: primaryPhone,
          patient_age: firstPatient.age ? Number.parseInt(firstPatient.age, 10) : null,
          patient_gender: firstPatient.gender || null,
          address,
          latitude: location ? Number(location.latitude) : null,
          longitude: location ? Number(location.longitude) : null,
          slot_datetime: slotDateTime,
          tests: storedTests,
          status: String(providerData.status || "scheduled").toLowerCase(),
          payment_status: "pending",
          notes: orangePayload.partner_notes || null,
          raw_response: providerData,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Orange Health accepted booking, but saving lab_orders failed:", dbError);
        return jsonResponse({
          success: true,
          provider_accepted: true,
          saved: false,
          order: providerData,
          warning:
            "Booking was accepted by Orange Health, but the local booking record could not be saved. Contact support before retrying.",
        });
      }

      return jsonResponse({ success: true, provider_accepted: true, saved: true, order: dbOrder, provider: providerData });
    }

    // -----------------------------------------------------------------------
    // cancel-order: cancels the WHOLE Orange request (partial cancel is not supported).
    // -----------------------------------------------------------------------
    if (action === "cancel-order") {
      const requestId = str(body.city_request_id) ?? "";
      const cancellationReason = typeof body.cancellation_reason === "string" ? body.cancellation_reason.trim() : "";
      const cancellationExplanation = typeof body.cancellation_explanation === "string"
        ? body.cancellation_explanation.trim()
        : "";

      if (!requestId) return fail(400, "invalid_request", "city_request_id is required");
      if (!cancellationReason) return fail(400, "invalid_request", "Please tell us why you are cancelling.");

      const { data: ownedOrders, error: ownedOrdersError } = await serviceClient
        .from("lab_orders")
        .select("id, city_request_id, raw_response, status, slot_datetime, address")
        .eq("city_request_id", requestId)
        .eq("user_id", user.id);

      if (ownedOrdersError) {
        console.error("Failed to look up Orange Health booking for cancellation:", ownedOrdersError);
        return fail(500, "lookup_failed", "Could not verify booking ownership");
      }
      if (!ownedOrders?.length) return fail(404, "order_not_found", "Order not found");

      const blocked = manageBlock(ownedOrders, "cancel");
      if (blocked) return fail(blocked.status, blocked.code, blocked.message);

      const rawResponse = ownedOrders.find((order: JsonObject) => order.raw_response?.token)?.raw_response;
      const token = typeof rawResponse?.token === "string" ? rawResponse.token.trim() : "";
      if (!token) {
        return fail(
          409,
          "token_missing",
          "This booking can't be cancelled online. Please contact support with your booking reference.",
        );
      }

      let cancelResult: { response: Response; data: JsonObject };
      try {
        cancelResult = await orangeFetch(
          `/v1/partner/${encodeURIComponent(requestId)}/cancel?token=${encodeURIComponent(token)}`,
          apiKey,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cancellationReason,
              cancellationExplanation, // optional per docs; an empty string is allowed
            }),
          },
        );
      } catch {
        return providerUnreachable();
      }
      if (!cancelResult.response.ok) {
        return providerFailure(cancelResult.response, cancelResult.data, "Failed to cancel Orange Health booking");
      }

      // Per Orange's docs the cancel call only ACCEPTS the request ("... is in process, please check order status to
      // confirm cancellation"). The documented order.cancelled webhook is the confirmation: orange-webhook then sets
      // lab_orders.status = cancelled. Until then the booking stays as it was and the UI shows "Cancellation pending".
      return jsonResponse({
        success: true,
        provider_accepted: true,
        cancellation_pending: true,
        message:
          "Cancellation request accepted by Orange Health. The booking will show as cancelled once Orange Health confirms it.",
        provider_message: providerMessage(cancelResult.data),
        status: cancelResult.response.status,
      });
    }

    // -----------------------------------------------------------------------
    // reschedule-order
    // -----------------------------------------------------------------------
    if (action === "reschedule-order") {
      const requestId = str(body.city_request_id) ?? "";
      const requestedSlot = normalizeSlot(body.requested_slot_time);
      const rescheduleReason = typeof body.reschedule_reason === "string" ? body.reschedule_reason.trim() : "";
      const rescheduleExplanation = typeof body.reschedule_explanation === "string"
        ? body.reschedule_explanation.trim()
        : "";

      if (!requestId) return fail(400, "invalid_request", "city_request_id is required");
      if (!requestedSlot) return fail(400, "invalid_slot", "Please choose a valid new time slot.");
      if (requestedSlot <= istNowWallClock()) {
        return fail(400, "slot_in_past", "That time slot has already passed. Please pick another slot.");
      }
      if (!rescheduleReason) return fail(400, "invalid_request", "Please tell us why you are rescheduling.");
      if (!rescheduleExplanation) return fail(400, "invalid_request", "Please add a short explanation for rescheduling.");

      const { data: ownedOrders, error: ownedOrdersError } = await serviceClient
        .from("lab_orders")
        .select("id, city_request_id, raw_response, status, slot_datetime, address")
        .eq("city_request_id", requestId)
        .eq("user_id", user.id);

      if (ownedOrdersError) {
        console.error("Failed to look up Orange Health booking for rescheduling:", ownedOrdersError);
        return fail(500, "lookup_failed", "Could not verify booking ownership");
      }
      if (!ownedOrders?.length) return fail(404, "order_not_found", "Order not found");

      const blocked = manageBlock(ownedOrders, "reschedule");
      if (blocked) return fail(blocked.status, blocked.code, blocked.message);

      const rawResponse = ownedOrders.find((order: JsonObject) => order.raw_response?.token)?.raw_response;
      const token = typeof rawResponse?.token === "string" ? rawResponse.token.trim() : "";
      if (!token) {
        return fail(
          409,
          "token_missing",
          "This booking can't be rescheduled online. Please contact support with your booking reference.",
        );
      }

      if (requestedSlot === slotFromDb(ownedOrders.find((o: JsonObject) => o.slot_datetime)?.slot_datetime)) {
        return fail(400, "same_slot", "That is already your current time slot. Please choose a different one.");
      }

      // Orange requires a valid, available slot. Re-validate it now against the booking's address.
      const address = cleanAddress(ownedOrders.find((o: JsonObject) => o.address)?.address);
      if (address) {
        const availability = await checkSlotAvailability(apiKey, address, requestedSlot);
        if (availability.available === false) {
          return fail(409, "slot_unavailable", "That time slot is no longer available. Please pick another slot.", {
            available_slots: availability.slots,
          });
        }
      }

      let rescheduleResult: { response: Response; data: JsonObject };
      try {
        rescheduleResult = await orangeFetch(
          `/v1/partner/${encodeURIComponent(requestId)}/reschedule?token=${encodeURIComponent(token)}`,
          apiKey,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requested_slot_time: requestedSlot, // always YYYY-MM-DDTHH:mm:ss
              reschedule_reason: rescheduleReason,
              reschedule_explanation: rescheduleExplanation,
            }),
          },
        );
      } catch {
        return providerUnreachable();
      }
      if (!rescheduleResult.response.ok) {
        return providerFailure(
          rescheduleResult.response,
          rescheduleResult.data,
          "Failed to reschedule Orange Health booking",
        );
      }

      // Accepted is not the same as confirmed. Orange confirms the final slot with the task.confirmed
      // webhook, which updates lab_orders.slot_datetime. Leave the stored slot untouched here.
      return jsonResponse({
        success: true,
        provider_accepted: true,
        awaiting_confirmation: true,
        saved: false,
        requested_slot_time: requestedSlot,
        message:
          "Orange Health accepted the reschedule request. The displayed slot will update when Orange Health confirms the new time.",
        data: rescheduleResult.data,
      });
    }

    return fail(400, "invalid_action", "Invalid action");
  } catch (error) {
    if (error instanceof ProviderUnreachableError) {
      console.error("Orange Health unreachable:", error.message);
      return providerUnreachable();
    }
    console.error("orange-health edge function error:", error instanceof Error ? error.message : error);
    return fail(500, "internal_error", "Something went wrong. Please try again.");
  }
}

serve(handleRequest);
