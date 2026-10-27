import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  TestTube2,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  FileCheck,
  Download,
  Loader2,
  ShieldCheck,
  Ban,
  CalendarClock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  BOOKING_LOCKED_CODES,
  OrangeHealthError,
  SLOT_PROBLEM_CODES,
  canManageOrder as isOrderManageable,
  canRescheduleOrder as isOrderReschedulable,
  getOrderDisplay,
  getPartialReportUrl,
  istToday,
  needsPaymentHint,
  parseInvokeFailure,
  parsePendingStorage,
  reconcilePending,
  removePending,
  slotPeriod,
  slotPeriodFromFlags,
  toSlotKey,
  type PendingMap,
  type StatusTone,
} from "./orangeLabHelpers";

interface SlotInfo {
  slot_datetime?: string;
  is_morning_slot: boolean;
  is_afternoon_slot: boolean;
  is_evening_slot: boolean;
}

interface LabOrder {
  id: string;
  orange_order_id?: string;
  city_request_id?: string;
  patient_name: string;
  patient_phone: string;
  patient_age?: number;
  patient_gender?: string;
  address: string;
  slot_datetime: string;
  tests: { test_id?: string; package_id?: string; name?: string }[];
  status: string;
  payment_status: string;
  report_url?: string;
  report_data?: unknown;
  raw_response?: unknown;
  created_at: string;
}

type CatalogKind = "test" | "package";

interface CatalogItem {
  id: string;
  name: string;
  kind: CatalogKind;
}

const isSameCatalogItem = (a: CatalogItem, b: CatalogItem) => a.kind === b.kind && a.id === b.id;

// SANDBOX catalogue. These are the only ids Orange Health allows for testing:
//   tests:    1, 2, 3
//   packages: 1, 2
// Orange keeps tests (test_id) and packages (package_id) in SEPARATE id spaces, so `kind` decides which list an
// item is sent in (tests[] vs packages[]). The names/descriptions below are neutral labels because Orange has not
// told us what these sandbox ids contain: rename them freely. `price` is optional and is simply hidden when absent
// (Orange sends the payment link itself).
// BEFORE PRODUCTION: replace this whole list with Orange's real production catalogue.
const POPULAR_TESTS: Array<CatalogItem & { desc: string; price?: string }> = [
  { id: "1", kind: "test", name: "Lab Test 1", desc: "Sandbox test (id 1)" },
  { id: "2", kind: "test", name: "Lab Test 2", desc: "Sandbox test (id 2)" },
  { id: "3", kind: "test", name: "Lab Test 3", desc: "Sandbox test (id 3)" },
  { id: "1", kind: "package", name: "Health Package 1", desc: "Sandbox package (id 1)" },
  { id: "2", kind: "package", name: "Health Package 2", desc: "Sandbox package (id 2)" },
];

const DEFAULT_RESCHEDULE_REASON = "Patient not available at originally scheduled time";
const DEFAULT_RESCHEDULE_EXPLANATION = "Patient is not available at the scheduled time";

// Don't query Orange for obviously partial addresses while the user is still typing.
const MIN_ADDRESS_CHARS_FOR_AUTO_CHECK = 12;

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  green: "bg-green-500/10 text-green-600 border-green-500/30",
  red: "bg-destructive/10 text-destructive border-destructive/30",
  orange: "bg-orange-500/10 text-orange-600 border-orange-500/30",
};

/**
 * Calls the orange-health edge function and returns its data, or throws an OrangeHealthError carrying the
 * backend's user-safe message, error code and (for slot conflicts) the slots that are still open.
 */
async function callOrangeHealth(body: Record<string, unknown>, fallbackMessage: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("orange-health", { body });
  if (error) {
    let payload: unknown = null;
    try {
      const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (context && typeof context.json === "function") payload = await context.json();
    } catch {
      // Non-JSON body or a network failure: fall back to the generic message.
    }
    const failure = parseInvokeFailure(payload, fallbackMessage);
    throw new OrangeHealthError(failure.message, failure.code, failure.availableSlots);
  }
  if (data && (data.success === false || typeof data.error === "string")) {
    const failure = parseInvokeFailure(data, fallbackMessage);
    throw new OrangeHealthError(failure.message, failure.code, failure.availableSlots);
  }
  return data;
}

export const OrangeLabTests: React.FC = () => {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"book" | "orders">("book");

  // Booking form state
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("male");
  const [address, setAddress] = useState("");
  const [partnerNotes, setPartnerNotes] = useState("");
  const [requestDate, setRequestDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [selectedTests, setSelectedTests] = useState<CatalogItem[]>([
    { id: "1", name: "Lab Test 1", kind: "test" },
  ]);

  // Slots state
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<Record<string, SlotInfo>>({});
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [serviceableStatus, setServiceableStatus] = useState<string | null>(null);

  // Submitting order state
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookedSuccess, setBookedSuccess] = useState<any | null>(null);

  // Orders list state
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [checkingResults, setCheckingResults] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [reschedulingOrderId, setReschedulingOrderId] = useState<string | null>(null);
  const [activeRescheduleFormId, setActiveRescheduleFormId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [rescheduleSlotOptions, setRescheduleSlotOptions] = useState<string[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleSlotsMessage, setRescheduleSlotsMessage] = useState<string | null>(null);
  const [rescheduleSlotPeriods, setRescheduleSlotPeriods] = useState<Record<string, string>>({});
  const [rescheduleReason, setRescheduleReason] = useState(DEFAULT_RESCHEDULE_REASON);
  const [rescheduleExplanation, setRescheduleExplanation] = useState(DEFAULT_RESCHEDULE_EXPLANATION);
  const slotsRequestRef = useRef(0);
  const rescheduleSlotsRequestRef = useRef(0);

  // Cancel / reschedule requests that Orange accepted but has not yet confirmed by webhook. They hide the buttons
  // (preventing duplicate requests) and survive a page reload via localStorage; they expire after 12h so a lost
  // webhook can never leave a booking stuck.
  const [pending, setPending] = useState<PendingMap>({});
  const pendingStorageKey = session?.user?.id ? `orange_lab_pending_v1:${session.user.id}` : null;

  useEffect(() => {
    if (!pendingStorageKey) return;
    try {
      setPending(parsePendingStorage(window.localStorage.getItem(pendingStorageKey)));
    } catch {
      // Storage unavailable: pending markers just won't survive a reload.
    }
  }, [pendingStorageKey]);

  const updatePending = useCallback(
    (updater: (current: PendingMap) => PendingMap) => {
      setPending((current) => {
        const next = updater(current);
        if (next !== current && pendingStorageKey) {
          try {
            window.localStorage.setItem(pendingStorageKey, JSON.stringify(next));
          } catch {
            // Storage unavailable or full: keep the in-memory state only.
          }
        }
        return next;
      });
    },
    [pendingStorageKey],
  );

  const getLocalDateTimeInputValue = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getLocalDateInputValue = (date = new Date()) => getLocalDateTimeInputValue(date).slice(0, 10);

  // Load user profile & address defaults
  useEffect(() => {
    if (!session?.user?.id) return;
    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, date_of_birth, gender")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile) {
        if (profile.full_name) setPatientName(profile.full_name);
        if (profile.phone) {
          const raw = profile.phone.replace(/\D/g, "");
          const national = raw.startsWith("91") && raw.length > 10 ? raw.slice(2) : raw;
          setPatientPhone(national);
        }
        if (profile.gender) setPatientGender(profile.gender.toLowerCase());
        if (profile.date_of_birth) {
          const birthYear = new Date(profile.date_of_birth).getFullYear();
          const currentYear = new Date().getFullYear();
          if (birthYear > 1900) setPatientAge(String(currentYear - birthYear));
        }
      }
    };

    loadProfile();
  }, [session?.user?.id]);

  // Fetch slots for the selected date. Orange geocodes the ADDRESS itself, so the address is the only location input.
  const checkSlots = useCallback(async (showToast = true, autoSelect = true) => {
    if (!requestDate) return;
    const trimmedAddress = address.trim();
    const requestToken = ++slotsRequestRef.current;

    if (!trimmedAddress) {
      setSlotsLoading(false);
      setSlots({});
      setSelectedSlot(null);
      setServiceableStatus("Enter your complete collection address to see available slots.");
      return;
    }

    setSlotsLoading(true);
    setServiceableStatus(null);
    try {
      const data = await callOrangeHealth(
        { action: "serviceability", request_date: requestDate, address: trimmedAddress },
        "Could not check collection availability. Please try again.",
      );
      if (requestToken !== slotsRequestRef.current) return; // a newer check superseded this one

      const responseData = data?.data;
      const availableSlots = responseData?.slots as Record<string, SlotInfo> | undefined;
      if (data?.serviceable !== false && availableSlots && Object.keys(availableSlots).length > 0) {
        const slotValues = Object.entries(availableSlots)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, info]) => info?.slot_datetime || key);
        setSlots(availableSlots);
        setServiceableStatus(responseData?.status || "Location is serviceable");
        // Keep the user's choice if it is still offered; otherwise pick the first slot (unless told not to).
        setSelectedSlot((previous) =>
          previous && slotValues.includes(previous) ? previous : autoSelect ? slotValues[0] ?? null : null
        );
      } else {
        setSlots({});
        setSelectedSlot(null);
        setServiceableStatus(
          responseData?.status || "No collection slots available for this date. Please choose another date."
        );
      }
    } catch (err) {
      if (requestToken !== slotsRequestRef.current) return;
      console.error("Failed to check serviceability:", err);
      const message = err instanceof OrangeHealthError ? err.message : "Failed to check serviceability. Please try again.";
      setSlots({});
      setSelectedSlot(null);
      setServiceableStatus(message);
      if (showToast) toast.error(message);
    } finally {
      if (requestToken === slotsRequestRef.current) setSlotsLoading(false);
    }
  }, [requestDate, address]);

  // Debounce address edits so Orange isn't queried on every keystroke or for an obviously partial address.
  useEffect(() => {
    const trimmed = address.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_ADDRESS_CHARS_FOR_AUTO_CHECK) {
      slotsRequestRef.current += 1;
      setSlotsLoading(false);
      setSlots({});
      setSelectedSlot(null);
      setServiceableStatus("Keep typing your complete address (house/flat, area, city and pincode) to see available slots.");
      return;
    }
    const timeoutId = window.setTimeout(() => { void checkSlots(false); }, trimmed ? 600 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [checkSlots, address]);

  // Load user's lab orders
  const loadOrders = async (): Promise<LabOrder[]> => {
    if (!session?.user?.id) return [];
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from("lab_orders" as any)
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const loadedOrders = ((data as any) || []) as LabOrder[];
      setOrders(loadedOrders);
      // Drop pending markers that the database (via Orange's webhooks) has now resolved, or that expired.
      updatePending((current) => reconcilePending(current, loadedOrders));
      return loadedOrders;
    } catch (err) {
      console.error("Failed to load lab orders:", err);
      return [];
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "orders") {
      loadOrders();
    }
  }, [activeTab]);

  // Toggle test selection. A test and a package can share the same id (e.g. test 1 and package 1), so an item
  // is identified by kind + id, never by id alone.
  const toggleTest = (test: CatalogItem) => {
    if (selectedTests.some((t) => isSameCatalogItem(t, test))) {
      if (selectedTests.length === 1) {
        toast.error("Please select at least one test");
        return;
      }
      setSelectedTests(selectedTests.filter((t) => !isSameCatalogItem(t, test)));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  // Submit booking order
  const handleBookOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return toast.error("Please enter patient name");
    if (!patientPhone.trim() || patientPhone.replace(/\D/g, "").length < 10) {
      return toast.error("Please enter a valid 10-digit mobile number");
    }
    if (!patientAge.trim() || !Number.isInteger(Number(patientAge)) || Number(patientAge) < 1 || Number(patientAge) > 120) {
      return toast.error("Please enter a valid patient age between 1 and 120");
    }
    if (!address.trim()) return toast.error("Please enter collection address");
    if (!selectedSlot) return toast.error("Please select an available collection time slot");
    if (selectedTests.length === 0) return toast.error("Please select at least one test");

    // Orange keeps tests (test_id) and packages (package_id) in separate lists; never send one as the other.
    const chosenTests = selectedTests.filter((t) => t.kind === "test");
    const chosenPackages = selectedTests.filter((t) => t.kind === "package");

    setBookingLoading(true);
    try {
      const data = await callOrangeHealth(
        {
          action: "create-order",
          address: address.trim(),
          primary_patient_name: patientName.trim(),
          primary_patient_number: patientPhone.replace(/\D/g, "").slice(-10),
          slot_datetime: selectedSlot,
          selected_tests: selectedTests.map((t) =>
            t.kind === "package" ? { package_id: t.id, name: t.name } : { test_id: t.id, name: t.name }
          ),
          ...(partnerNotes.trim() ? { partner_notes: partnerNotes.trim() } : {}),
          patient_details: [
            {
              partner_reference_id: `patient_${session?.user?.id?.slice(0, 8)}`,
              patient_name: patientName.trim(),
              patient_phone: patientPhone.replace(/\D/g, "").slice(-10),
              age: String(Number(patientAge)),
              gender: patientGender || "male",
              ...(chosenTests.length ? { tests: chosenTests.map((t) => ({ test_id: String(t.id) })) } : {}),
              ...(chosenPackages.length ? { packages: chosenPackages.map((t) => ({ package_id: String(t.id) })) } : {}),
            },
          ],
        },
        "Booking creation failed",
      );

      if (data?.success !== true || data?.provider_accepted !== true) {
        throw new Error("Orange Health did not confirm the booking. Please check your bookings before retrying.");
      }

      setBookedSuccess(data?.order || data?.provider || { success: true });
      if (data?.saved === false) {
        toast.error(data?.warning || "Orange Health accepted the booking, but the local record could not be saved. Contact support before retrying.");
      } else {
        toast.success("Booking request accepted by Orange Health. Check My Bookings for confirmation.");
      }
      await loadOrders();
    } catch (err) {
      console.error(err);
      if (err instanceof OrangeHealthError && err.code === "slot_unavailable") {
        // Someone else took the slot. Refresh the list without auto-picking a replacement for the user.
        setSelectedSlot(null);
        void checkSlots(false, false);
      }
      toast.error(err instanceof Error ? err.message : "Failed to book home lab test");
    } finally {
      setBookingLoading(false);
    }
  };

  // Poll / fetch test results
  // Reports are pushed to us per order by Orange's webhook (order.completed), so "refresh" just reloads our records.
  const handleRefreshStatus = async (order: LabOrder) => {
    setCheckingResults(order.id);
    try {
      const fresh = await loadOrders();
      const updated = fresh.find((o) => o.id === order.id);
      if (updated?.report_url) {
        toast.success("Your report is ready.");
      } else {
        toast.info("Your report appears here automatically once the lab releases it (after payment is complete).");
      }
    } finally {
      setCheckingResults(null);
    }
  };

  const handleCancelOrder = async (order: LabOrder) => {
    const requestId = order.city_request_id;
    if (!requestId) {
      toast.error("This booking is missing its Orange Health request ID.");
      return;
    }

    const confirmed = window.confirm(
      "Cancel this Orange Health request? This may cancel every patient/order associated with the same request ID. Continue only if you want to cancel the entire request."
    );
    if (!confirmed) return;

    const reason = window.prompt("Reason for cancellation:", "Customer requested");
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Please provide a cancellation reason.");
      return;
    }
    const explanation = window.prompt("Additional explanation (optional):", "");
    if (explanation === null) return;

    setCancellingOrderId(order.id);
    try {
      const data = await callOrangeHealth(
        {
          action: "cancel-order",
          city_request_id: requestId,
          cancellation_reason: reason.trim(),
          ...(explanation.trim() ? { cancellation_explanation: explanation.trim() } : {}),
        },
        "Cancellation request failed.",
      );
      if (data?.success !== true) throw new Error("Cancellation request failed.");

      if (data?.cancellation_pending === true) {
        updatePending((current) => ({ ...current, [requestId]: { kind: "cancel", at: Date.now() } }));
        toast.info(data?.message || "Cancellation is pending confirmation from Orange Health.");
      } else {
        updatePending((current) => removePending(current, requestId));
        if (data?.saved === false) {
          toast.error(data?.warning || "Orange Health confirmed cancellation, but the local booking status could not be updated. Refresh or contact support.");
        } else {
          toast.success(data?.message || "Orange Health confirmed the cancellation.");
        }
      }
      await loadOrders();
    } catch (err) {
      console.error("Cancellation request failed:", err);
      // The booking can no longer be changed (medic assigned, already cancelled...): refresh so the buttons disappear.
      if (err instanceof OrangeHealthError && err.code && BOOKING_LOCKED_CODES.has(err.code)) void loadOrders();
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking.");
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Slots for the reschedule picker. Same address-only serviceability call as booking, using the BOOKING's address.
  const loadRescheduleSlots = async (order: LabOrder, date: string) => {
    const requestToken = ++rescheduleSlotsRequestRef.current;
    setRescheduleSlot("");
    setRescheduleSlotOptions([]);
    setRescheduleSlotPeriods({});
    setRescheduleSlotsMessage(null);

    if (!order.address?.trim()) {
      setRescheduleSlotsLoading(false);
      setRescheduleSlotsMessage("This booking has no collection address on file. Please contact support.");
      return;
    }
    if (!date || date < istToday()) {
      setRescheduleSlotsLoading(false);
      setRescheduleSlotsMessage("Please choose today or a future date.");
      return;
    }

    setRescheduleSlotsLoading(true);
    try {
      const data = await callOrangeHealth(
        { action: "serviceability", request_date: date, address: order.address.trim() },
        "Could not fetch available slots for this date.",
      );
      if (requestToken !== rescheduleSlotsRequestRef.current) return;

      const offered: string[] = Array.isArray(data?.available_slots)
        ? data.available_slots.filter((s: unknown): s is string => typeof s === "string")
        : [];
      const current = toSlotKey(order.slot_datetime);
      const options = offered.filter((slot) => slot !== current);
      // Use Orange's own morning/afternoon/evening flags for the labels.
      const periods: Record<string, string> = {};
      const offeredInfo = data?.data?.slots && typeof data.data.slots === "object" ? data.data.slots : {};
      for (const [key, info] of Object.entries(offeredInfo) as Array<[string, any]>) {
        const slot = toSlotKey(info?.slot_datetime ?? key);
        const period = slotPeriodFromFlags(info);
        if (slot && period) periods[slot] = period;
      }
      setRescheduleSlotPeriods(periods);
      setRescheduleSlotOptions(options);
      if (options.length === 0) {
        setRescheduleSlotsMessage(
          offered.length > 0
            ? "The only slot on this date is your current one. Please choose another date."
            : "No collection slots are open on this date. Please choose another date.",
        );
      }
    } catch (err) {
      if (requestToken !== rescheduleSlotsRequestRef.current) return;
      console.error("Failed to load reschedule slots:", err);
      setRescheduleSlotsMessage(err instanceof Error ? err.message : "Could not fetch available slots for this date.");
    } finally {
      if (requestToken === rescheduleSlotsRequestRef.current) setRescheduleSlotsLoading(false);
    }
  };

  const openRescheduleForm = (order: LabOrder) => {
    const today = istToday();
    const currentDate = toSlotKey(order.slot_datetime)?.slice(0, 10);
    const initialDate = currentDate && currentDate >= today ? currentDate : today;
    setActiveRescheduleFormId(order.id);
    setRescheduleDate(initialDate);
    void loadRescheduleSlots(order, initialDate);
  };

  const handleRescheduleOrder = async (order: LabOrder) => {
    const requestId = order.city_request_id;
    if (!requestId) {
      toast.error("This booking is missing its Orange Health request ID.");
      return;
    }
    if (!rescheduleSlot) {
      toast.error("Please select a new collection time slot.");
      return;
    }
    if (rescheduleSlot === toSlotKey(order.slot_datetime)) {
      toast.error("Please choose a different collection time.");
      return;
    }
    if (!rescheduleReason.trim() || !rescheduleExplanation.trim()) {
      toast.error("Please enter both a rescheduling reason and explanation.");
      return;
    }

    setReschedulingOrderId(order.id);
    try {
      // rescheduleSlot is always one of the slots Orange returned for this address (YYYY-MM-DDTHH:mm:ss).
      const data = await callOrangeHealth(
        {
          action: "reschedule-order",
          city_request_id: requestId,
          requested_slot_time: rescheduleSlot,
          reschedule_reason: rescheduleReason.trim(),
          reschedule_explanation: rescheduleExplanation.trim(),
        },
        "Rescheduling request failed.",
      );
      if (data?.success !== true) throw new Error("Rescheduling request failed.");

      if (data?.awaiting_confirmation === true) {
        updatePending((current) => ({
          ...current,
          [requestId]: { kind: "reschedule", slot: order.slot_datetime, at: Date.now() },
        }));
        toast.info(data?.message || "Reschedule accepted. Waiting for Orange Health to confirm the new slot.");
      } else {
        toast.success(data?.message || "Rescheduling request accepted by Orange Health.");
      }
      setActiveRescheduleFormId(null);
      setRescheduleSlot("");
      setRescheduleSlotOptions([]);
      setRescheduleReason(DEFAULT_RESCHEDULE_REASON);
      setRescheduleExplanation(DEFAULT_RESCHEDULE_EXPLANATION);
      await loadOrders();
    } catch (err) {
      console.error("Rescheduling request failed:", err);
      if (err instanceof OrangeHealthError && err.code) {
        if (BOOKING_LOCKED_CODES.has(err.code)) {
          // Can't be changed any more: close the form and refresh so the buttons disappear.
          setActiveRescheduleFormId(null);
          void loadOrders();
        } else if (SLOT_PROBLEM_CODES.has(err.code)) {
          // The chosen slot went away: refresh the picker so the user chooses from what is open now.
          void loadRescheduleSlots(order, rescheduleDate);
        }
      }
      toast.error(err instanceof Error ? err.message : "Failed to reschedule booking.");
    } finally {
      setReschedulingOrderId(null);
    }
  };

  // Preserve provider wall-clock times instead of timezone-shifting naive ISO strings.
  const getSlotParts = (slotValue: string) => {
    const match = slotValue.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) return { date: match[1], time: `${match[2]}:${match[3]}` };
    const parsed = new Date(slotValue);
    if (Number.isNaN(parsed.getTime())) return { date: "", time: slotValue };
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
  };

  const formatSlotTime = (slotValue: string) => {
    const { time } = getSlotParts(slotValue);
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return time || slotValue;
    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
  };

  const formatSlotDateTime = (slotValue: string) => {
    const { date } = getSlotParts(slotValue);
    const dateLabel = date
      ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
          year: "numeric", month: "short", day: "numeric",
        })
      : "";
    return [dateLabel, formatSlotTime(slotValue)].filter(Boolean).join(" at ");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-600/10 border border-orange-500/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <TestTube2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Home Lab Tests</h2>
              <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30">
                Orange Health Labs
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Certified e-medics collect blood & urine samples at your doorstep in 60 mins.
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-muted/60 p-1 rounded-xl shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("book");
              setBookedSuccess(null);
            }}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "book" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Book New Test
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "orders" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Bookings & Reports
          </button>
        </div>
      </div>

      {/* SUCCESS SCREEN */}
      {bookedSuccess && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6 pb-6 text-center space-y-4">
            <div className="w-14 h-14 bg-green-500/20 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Booking Request Accepted</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                Orange Health has accepted your booking request. The final collection schedule and status will be reflected in My Bookings when confirmed by Orange Health.
              </p>
            </div>

            <div className="bg-card border rounded-xl p-4 max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient:</span>
                <span className="font-semibold">{patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled Slot:</span>
                <span className="font-semibold">{selectedSlot ? formatSlotDateTime(selectedSlot) : "Pending confirmation"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Mode:</span>
                <span className="font-semibold text-orange-600">Direct Link from Orange Health</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-medium truncate max-w-[200px]">{address}</span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBookedSuccess(null);
                  setActiveTab("orders");
                }}
              >
                View My Bookings
              </Button>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => setBookedSuccess(null)}
              >
                Book Another Test
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 1: BOOKING FORM */}
      {activeTab === "book" && !bookedSuccess && (
        <form onSubmit={handleBookOrder} className="space-y-6">
          {/* Step 1: Select Tests */}
          <Card>
            <CardContent className="pt-5 pb-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-600 text-xs flex items-center justify-center font-bold">
                      1
                    </span>
                    Select Lab Tests & Health Packages
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose one or more diagnostic tests for home sample collection.
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {selectedTests.length} selected
                </Badge>
              </div>

              {/* Grid of Tests */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {POPULAR_TESTS.map((test) => {
                  const isSelected = selectedTests.some((t) => isSameCatalogItem(t, test));
                  return (
                    <div
                      key={`${test.kind}-${test.id}`}
                      onClick={() => toggleTest({ id: test.id, name: test.name, kind: test.kind })}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? "border-orange-500 bg-orange-500/10 dark:bg-orange-500/15"
                          : "border-border/60 hover:border-orange-500/40 bg-card"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          {test.name}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{test.desc}</p>
                        {test.price && <span className="text-xs font-semibold text-orange-600">{test.price}</span>}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? "bg-orange-600 border-orange-600 text-white" : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Only Orange Health catalogue IDs can be submitted to the provider. */}
              {/* Selected summary */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedTests.map((t) => (
                  <Badge key={`${t.kind}-${t.id}`} variant="secondary" className="text-xs gap-1 py-1">
                    {t.name}
                    <button
                      type="button"
                      onClick={() => toggleTest(t)}
                      className="text-muted-foreground hover:text-destructive ml-1"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Patient & Address Information */}
          <Card>
            <CardContent className="pt-5 pb-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-600 text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Patient & Collection Address
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Patient Full Name *</Label>
                  <Input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Full name as on Aadhaar/Govt ID"
                    required
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Contact Mobile Number *</Label>
                  <Input
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    required
                    maxLength={10}
                    className="text-xs h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Orange Labs will WhatsApp payment link & technician tracking to this number.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Age *</Label>
                  <Input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="Age (e.g. 68)"
                    min={1}
                    max={120}
                    required
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Gender</Label>
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-600" />
                  Complete Address with House/Flat No & Landmark *
                </Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. #402, Sunshine Apartments, 80ft Road, Koramangala, Bengaluru - 560034"
                  required
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold">
                  Partner Notes <span className="font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <textarea
                  value={partnerNotes}
                  onChange={(e) => setPartnerNotes(e.target.value)}
                  placeholder="e.g. A senior eMedic is required to handle a senior citizen."
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-[10px] text-muted-foreground">
                  For specific operational instructions only. Leave blank if none. These notes may be used by Orange Health's operations team to assign an appropriate eMedic or contact the customer.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Schedule Date & Collection Slot */}
          <Card>
            <CardContent className="pt-5 pb-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-600 text-xs flex items-center justify-center font-bold">
                    3
                  </span>
                  Select Collection Date & Time Slot
                </h3>
                {serviceableStatus && (
                  <Badge variant="outline" className="text-[11px] text-orange-600 border-orange-500/30">
                    {serviceableStatus}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="space-y-1.5 flex-1 max-w-[200px]">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-orange-600" />
                    Collection Date
                  </Label>
                  <Input
                    type="date"
                    value={requestDate}
                    min={getLocalDateInputValue()}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void checkSlots()}
                  disabled={slotsLoading}
                  className="mt-5 text-xs h-9"
                >
                  {slotsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Refresh Slots"}
                </Button>
              </div>

              {/* Slots List */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-orange-600" />
                  Available Home Collection Slots
                </Label>

                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                    Fetching real-time slots from Orange Health...
                  </div>
                ) : Object.keys(slots).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {Object.entries(slots).sort(([a], [b]) => a.localeCompare(b)).map(([slotKey, info]) => {
                      const slotDateTime = info?.slot_datetime || slotKey;
                      const isSelected = selectedSlot === slotDateTime;
                      return (
                        <button
                          key={slotKey}
                          type="button"
                          onClick={() => setSelectedSlot(slotDateTime)}
                          className={`p-2.5 rounded-xl border text-center transition-all ${
                            isSelected
                              ? "border-orange-500 bg-orange-600 text-white shadow-sm"
                              : "border-border/70 hover:border-orange-500/40 bg-card text-foreground"
                          }`}
                        >
                          <div className="text-xs font-bold">{formatSlotTime(slotDateTime)}</div>
                          <div className={`text-[10px] mt-0.5 ${isSelected ? "text-orange-100" : "text-muted-foreground"}`}>
                            {slotPeriodFromFlags(info) ?? slotPeriod(slotDateTime)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                    No collection slots open for this date/location. Please pick another date.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Disclosure & Submit */}
          <div className="bg-muted/40 rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <span>
                <strong>100% Safe & Zero Upfront Check-iN Fee:</strong> Payment link will be sent to the patient directly by Orange Health Labs. No payment required right now.
              </span>
            </div>

            <Button
              type="submit"
              disabled={bookingLoading || !selectedSlot}
              className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 w-full sm:w-auto px-6 h-10 font-bold"
            >
              {bookingLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Booking with Orange Labs...
                </>
              ) : (
                "Confirm Home Collection"
              )}
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: MY BOOKINGS & REPORTS */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Diagnostic Bookings & Reports</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadOrders}
              disabled={ordersLoading}
              className="text-xs h-8"
            >
              {ordersLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          {ordersLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-orange-600 mx-auto mb-2" />
              Loading your bookings...
            </div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <FileCheck className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <div className="text-xs text-muted-foreground">You have not booked any lab tests yet.</div>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("book")}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                >
                  Book Your First Test
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => {
                const display = getOrderDisplay(ord, pending);
                const requestId = ord.city_request_id || "";
                const pendingKind = requestId ? pending[requestId]?.kind : undefined;
                const partialReportUrl = ord.report_url ? null : getPartialReportUrl(ord);
                const busy = cancellingOrderId === ord.id || reschedulingOrderId === ord.id;
                return (
                <Card key={ord.id} className="overflow-hidden">
                  <CardContent className="p-4 sm:p-5 flex flex-col items-stretch gap-3">
                    <div className="space-y-1.5 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{ord.patient_name}</span>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_TONE_CLASSES[display.tone]}`}>
                          {display.label}
                        </Badge>
                        {ord.city_request_id && (
                          <span className="text-[10px] text-muted-foreground">
                            Ref: {ord.city_request_id}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span>📅 Slot: {formatSlotDateTime(ord.slot_datetime)}</span>
                        <span>📍 {ord.address}</span>
                      </div>
                      {needsPaymentHint(ord) && (
                        <p className="text-[11px] text-muted-foreground">
                          Your report is released after payment. If you haven't paid yet, use the payment link Orange Health sent to your phone on WhatsApp or SMS.
                        </p>
                      )}
                      {isOrderManageable(ord, pending) && !isOrderReschedulable(ord, pending) && (
                        <p className="text-[11px] text-muted-foreground">This slot time has already passed, so it can't be rescheduled.</p>
                      )}
                      {pendingKind === "reschedule" && (
                        <p className="text-[11px] text-orange-600">New time requested. The displayed slot will change after Orange Health confirms it.</p>
                      )}
                      {pendingKind === "cancel" && (
                        <p className="text-[11px] text-orange-600">Cancellation requested. Waiting for Orange Health confirmation.</p>
                      )}

                      {/* Tests list */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {ord.tests && Array.isArray(ord.tests) && ord.tests.map((t, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px]">
                            {t.name || (t.package_id ? `Package #${t.package_id}` : `Test #${t.test_id || idx + 1}`)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 w-full justify-end">
                      {ord.report_url ? (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs h-8"
                          onClick={() => window.open(ord.report_url, "_blank")}
                        >
                          <Download className="w-3.5 h-3.5" />
                          View Lab Report
                        </Button>
                      ) : partialReportUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => window.open(partialReportUrl, "_blank")}
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          View partial report
                        </Button>
                      ) : display.tone !== "red" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={checkingResults === ord.id}
                          onClick={() => handleRefreshStatus(ord)}
                          className="gap-1.5 text-xs h-8"
                        >
                          {checkingResults === ord.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileCheck className="w-3.5 h-3.5" />
                          )}
                          Refresh status
                        </Button>
                      ) : null}
                      {isOrderManageable(ord, pending) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleCancelOrder(ord)}
                          className="gap-1.5 text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          {cancellingOrderId === ord.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Ban className="w-3.5 h-3.5" />
                          )}
                          Cancel
                        </Button>
                      )}
                      {isOrderReschedulable(ord, pending) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => openRescheduleForm(ord)}
                          className="gap-1.5 text-xs h-8"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          Reschedule
                        </Button>
                      )}
                    </div>
                    {activeRescheduleFormId === ord.id && (
                      <div className="w-full border-t pt-4 mt-2 space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold">Reschedule collection</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Current slot: {formatSlotDateTime(ord.slot_datetime)}. Pick a new date, then choose one of the slots available for your address.
                          </p>
                        </div>

                        <div className="space-y-1 max-w-[200px]">
                          <Label className="text-xs font-semibold flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-orange-600" />
                            New date
                          </Label>
                          <Input
                            type="date"
                            value={rescheduleDate}
                            min={istToday()}
                            onChange={(e) => {
                              setRescheduleDate(e.target.value);
                              void loadRescheduleSlots(ord, e.target.value);
                            }}
                            className="text-xs h-9"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-orange-600" />
                            Available slots
                          </Label>
                          {rescheduleSlotsLoading ? (
                            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                              Fetching available slots...
                            </div>
                          ) : rescheduleSlotOptions.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                              {rescheduleSlotOptions.map((slot) => {
                                const isSelected = rescheduleSlot === slot;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => setRescheduleSlot(slot)}
                                    className={`p-2.5 rounded-xl border text-center transition-all ${
                                      isSelected
                                        ? "border-orange-500 bg-orange-600 text-white shadow-sm"
                                        : "border-border/70 hover:border-orange-500/40 bg-card text-foreground"
                                    }`}
                                  >
                                    <div className="text-xs font-bold">{formatSlotTime(slot)}</div>
                                    <div className={`text-[10px] mt-0.5 ${isSelected ? "text-orange-100" : "text-muted-foreground"}`}>
                                      {rescheduleSlotPeriods[slot] ?? slotPeriod(slot)}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                              {rescheduleSlotsMessage || "Choose a date to see available slots."}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Reason</Label>
                            <Input
                              value={rescheduleReason}
                              onChange={(e) => setRescheduleReason(e.target.value)}
                              placeholder="Reason for rescheduling"
                              className="text-xs h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Explanation</Label>
                            <Input
                              value={rescheduleExplanation}
                              onChange={(e) => setRescheduleExplanation(e.target.value)}
                              placeholder="Explain why the booking needs to be rescheduled"
                              className="text-xs h-9"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setActiveRescheduleFormId(null)}>
                            Close
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            disabled={reschedulingOrderId === ord.id || !rescheduleSlot}
                            onClick={() => void handleRescheduleOrder(ord)}
                          >
                            {reschedulingOrderId === ord.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit reschedule"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrangeLabTests;
