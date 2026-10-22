import React, { useState, useEffect, useCallback } from "react";
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
  tests: { test_id?: string; name?: string }[];
  status: string;
  payment_status: string;
  report_url?: string;
  created_at: string;
}

// Common starter diagnostic tests
const POPULAR_TESTS = [
  { id: "3", name: "Complete Blood Count (CBC)", desc: "Overall health & infection screen", price: "₹299" },
  { id: "4", name: "Lipid Profile (Cholesterol)", desc: "Heart health & cardiovascular risk", price: "₹450" },
  { id: "5", name: "HbA1c (Blood Sugar 3-Month)", desc: "Diabetes diagnosis & monitoring", price: "₹399" },
  { id: "6", name: "Thyroid Profile (T3, T4, TSH)", desc: "Thyroid gland evaluation", price: "₹499" },
  { id: "7", name: "Liver Function Test (LFT)", desc: "Liver enzymes & proteins", price: "₹599" },
  { id: "8", name: "Kidney Function Test (KFT)", desc: "Creatinine, urea & electrolytes", price: "₹549" },
  { id: "9", name: "Vitamin D & B12 Combo", desc: "Bone strength & nerve vitality", price: "₹899" },
  { id: "10", name: "Senior Citizen Comprehensive Package", desc: "60+ vital parameters for elders", price: "₹1,499" },
];

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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [requestDate, setRequestDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [selectedTests, setSelectedTests] = useState<{ id: string; name: string }[]>([
    { id: "3", name: "Complete Blood Count (CBC)" },
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
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("Patient not available at originally scheduled time");
  const [rescheduleExplanation, setRescheduleExplanation] = useState("Patient is not available at the scheduled time");
  // These flags prevent duplicate requests while waiting for Orange Health webhooks/status updates.
  const [pendingCancellationIds, setPendingCancellationIds] = useState<string[]>([]);
  const [pendingRescheduleSlots, setPendingRescheduleSlots] = useState<Record<string, string>>({});

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

  // Try fetching user's current GPS if available
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
        },
        () => {
          // Location permission was not granted; the user can enter an address manually.
        },
        { timeout: 5000 }
      );
    }
  }, []);

  // Fetch slots for the selected date and collection location.
  const checkSlots = useCallback(async (showToast = true) => {
    if (!requestDate) return;
    const trimmedAddress = address.trim();
    const hasCoordinates = latitude !== null && longitude !== null;

    if (!trimmedAddress && !hasCoordinates) {
      setSlots({});
      setSelectedSlot(null);
      setServiceableStatus("Enter your collection address or allow location access to check slots.");
      return;
    }

    setSlotsLoading(true);
    setServiceableStatus(null);
    try {
      const requestBody: Record<string, unknown> = {
        action: "serviceability",
        request_date: requestDate,
      };
      if (trimmedAddress) requestBody.address = trimmedAddress;
      else if (hasCoordinates) {
        requestBody.latitude = latitude;
        requestBody.longitude = longitude;
      }

      const { data, error } = await supabase.functions.invoke("orange-health", { body: requestBody });
      if (error) {
        console.error("Slots fetch error:", error);
        setSlots({});
        setSelectedSlot(null);
        setServiceableStatus("Could not fetch slots. Please refresh and try again.");
        if (showToast) toast.error("Could not fetch available slots for this date");
        return;
      }

      if (data?.error) {
        const message = data?.details?.status || data?.details?.message || data?.error ||
          "Could not check collection availability.";
        setSlots({});
        setSelectedSlot(null);
        setServiceableStatus(message);
        if (showToast) toast.error(message);
        return;
      }

      const responseData = data?.data;
      const availableSlots = responseData?.slots;
      if (availableSlots && Object.keys(availableSlots).length > 0) {
        setSlots(availableSlots);
        setServiceableStatus(responseData.status || "Location is serviceable");
        const firstEntry = Object.entries(availableSlots)[0] as [string, SlotInfo];
        setSelectedSlot(firstEntry[1]?.slot_datetime || firstEntry[0]);
      } else {
        setSlots({});
        setSelectedSlot(null);
        setServiceableStatus(responseData?.status ||
          "No collection slots available for this date. Please choose another date.");
      }
    } catch (err) {
      console.error("Failed to check serviceability:", err);
      setSlots({});
      setSelectedSlot(null);
      setServiceableStatus("Failed to check serviceability. Please try again.");
      if (showToast) toast.error("Failed to check serviceability");
    } finally {
      setSlotsLoading(false);
    }
  }, [requestDate, address, latitude, longitude]);

  // Debounce address edits so serviceability is not checked on every keystroke.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void checkSlots(false); }, address.trim() ? 600 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [checkSlots]);

  // Load user's lab orders
  const loadOrders = async () => {
    if (!session?.user?.id) return;
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
      const cancelledRequestIds = new Set(loadedOrders
        .filter((order) => ["cancelled", "canceled"].includes((order.status || "").toLowerCase()))
        .map((order) => order.city_request_id || ""));
      setPendingCancellationIds((current) => current.filter((id) => !cancelledRequestIds.has(id)));
      // Clear pending reschedule markers once the webhook changes the stored slot.
      setPendingRescheduleSlots((current) => {
        const next = { ...current };
        for (const order of loadedOrders) {
          const requestId = order.city_request_id || "";
          if (requestId && Object.prototype.hasOwnProperty.call(next, requestId) && order.slot_datetime !== next[requestId]) {
            delete next[requestId];
          }
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to load lab orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "orders") {
      loadOrders();
    }
  }, [activeTab]);

  // Toggle test selection
  const toggleTest = (test: { id: string; name: string }) => {
    if (selectedTests.some((t) => t.id === test.id)) {
      if (selectedTests.length === 1) {
        toast.error("Please select at least one test");
        return;
      }
      setSelectedTests(selectedTests.filter((t) => t.id !== test.id));
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

    setBookingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("orange-health", {
        body: {
          action: "create-order",
          address,
          ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
          primary_patient_name: patientName.trim(),
          primary_patient_number: patientPhone.replace(/\D/g, "").slice(-10),
          slot_datetime: selectedSlot,
          payment_type: "paid_by_patient",
          selected_tests: selectedTests.map((test) => ({ test_id: test.id, name: test.name })),
          ...(partnerNotes.trim() ? { partner_notes: partnerNotes.trim() } : {}),
          patient_details: [
            {
              partner_reference_id: `patient_${session?.user?.id?.slice(0, 8)}`,
              patient_name: patientName.trim(),
              patient_phone: patientPhone.replace(/\D/g, "").slice(-10),
              age: String(Number(patientAge)),
              gender: patientGender || "male",
              tests: selectedTests.map((t) => ({ test_id: String(t.id) })),
            },
          ],
        },
      });

      if (error) {
        let errorMsg = error.message;
        try {
          const body = (error as any).context ? await (error as any).context.json() : null;
          if (body?.details?.status) errorMsg = body.details.status;
          else if (body?.details?.message) errorMsg = body.details.message;
          else if (body?.error) errorMsg = body.error;
        } catch {
          // fallback to error.message
        }
        throw new Error(errorMsg || "Booking creation failed");
      }

      if (data?.error) {
        const msg = data?.details?.status || data?.details?.message || data.error;
        throw new Error(msg);
      }

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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to book home lab test");
    } finally {
      setBookingLoading(false);
    }
  };

  // Poll / fetch test results
  const handleCheckResults = async (order: LabOrder) => {
    setCheckingResults(order.id);
    try {
      const { data, error } = await supabase.functions.invoke("orange-health", {
        body: {
          action: "test-results",
          primary_patient_number: order.patient_phone,
          order_id: order.id,
        },
      });

      if (error) throw error;

      if (data?.ready && data?.data?.report_url) {
        toast.success("Test report is ready!");
        loadOrders();
        window.open(data.data.report_url, "_blank");
      } else {
        toast.info(data?.message || "Sample is being processed by the lab. Report not ready yet.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to check report status");
    } finally {
      setCheckingResults(null);
    }
  };

  const canManageOrder = (order: LabOrder) => {
    const status = (order.status || "").toLowerCase().replace(/[ -]/g, "_");
    const requestId = order.city_request_id || "";
    return Boolean(requestId) &&
      !pendingCancellationIds.includes(requestId) &&
      !Object.prototype.hasOwnProperty.call(pendingRescheduleSlots, requestId) &&
      !["cancelled", "canceled", "completed", "cancellation_pending", "cancelled_pending", "reschedule_pending"].includes(status);
  };

  const getOrderStatusLabel = (order: LabOrder) => {
    const requestId = order.city_request_id || "";
    if (pendingCancellationIds.includes(requestId)) return "Cancellation pending";
    if (Object.prototype.hasOwnProperty.call(pendingRescheduleSlots, requestId)) return "Reschedule pending";
    return (order.status || "requested").replace(/_/g, " ");
  };

  const handleCancelOrder = async (order: LabOrder) => {
    if (!order.city_request_id) {
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
      const { data, error } = await supabase.functions.invoke("orange-health", {
        body: {
          action: "cancel-order",
          city_request_id: order.city_request_id,
          cancellation_reason: reason.trim(),
          ...(explanation.trim() ? { cancellation_explanation: explanation.trim() } : {}),
        },
      });

      if (error) {
        let message = error.message || "Cancellation request failed.";
        try {
          const details = (error as any).context ? await (error as any).context.json() : null;
          message = details?.details?.message || details?.details?.detail || details?.error || message;
        } catch {
          // Keep the original error message.
        }
        throw new Error(message);
      }
      if (data?.error || data?.success !== true) {
        throw new Error(data?.details?.message || data?.details?.detail || data?.error || "Cancellation request failed.");
      }

      if (data?.cancellation_pending === true) {
        setPendingCancellationIds((current) => current.includes(order.city_request_id!) ? current : [...current, order.city_request_id!]);
        toast.info(data?.message || "Cancellation is pending confirmation from Orange Health.");
      } else {
        setPendingCancellationIds((current) => current.filter((id) => id !== order.city_request_id));
        if (data?.saved === false) {
          toast.error(data?.warning || "Orange Health confirmed cancellation, but the local booking status could not be updated. Refresh or contact support.");
        } else {
          toast.success(data?.message || "Orange Health confirmed the cancellation.");
        }
      }
      await loadOrders();
    } catch (err: any) {
      console.error("Cancellation request failed:", err);
      toast.error(err.message || "Failed to cancel booking.");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleRescheduleOrder = async (order: LabOrder) => {
    if (!order.city_request_id) {
      toast.error("This booking is missing its Orange Health request ID.");
      return;
    }
    if (!rescheduleSlot) {
      toast.error("Please select a new collection date and time.");
      return;
    }
    const requestedDate = new Date(rescheduleSlot);
    if (Number.isNaN(requestedDate.getTime()) || requestedDate.getTime() <= Date.now()) {
      toast.error("Please select a future collection date and time.");
      return;
    }
    if (order.slot_datetime && rescheduleSlot === order.slot_datetime.slice(0, 16)) {
      toast.error("Please choose a different collection time.");
      return;
    }
    if (!rescheduleReason.trim() || !rescheduleExplanation.trim()) {
      toast.error("Please enter both a rescheduling reason and explanation.");
      return;
    }

    // datetime-local gives a local wall-clock value in YYYY-MM-DDTHH:mm format.
    setReschedulingOrderId(order.id);
    try {
      const { data, error } = await supabase.functions.invoke("orange-health", {
        body: {
          action: "reschedule-order",
          city_request_id: order.city_request_id,
          requested_slot_time: rescheduleSlot,
          reschedule_reason: rescheduleReason.trim(),
          reschedule_explanation: rescheduleExplanation.trim(),
        },
      });

      if (error) {
        let message = error.message || "Rescheduling request failed.";
        try {
          const details = (error as any).context ? await (error as any).context.json() : null;
          message = details?.details?.message || details?.details?.detail || details?.error || message;
        } catch {
          // Keep the original error message.
        }
        throw new Error(message);
      }
      if (data?.error || data?.success !== true) {
        throw new Error(data?.details?.message || data?.details?.detail || data?.error || "Rescheduling request failed.");
      }

      if (data?.awaiting_confirmation === true) {
        setPendingRescheduleSlots((current) => ({
          ...current,
          [order.city_request_id!]: order.slot_datetime,
        }));
        toast.info(data?.message || "Reschedule accepted. Waiting for Orange Health to confirm the new slot.");
      } else {
        toast.success(data?.message || "Rescheduling request accepted by Orange Health.");
      }
      setReschedulingOrderId(null);
      setActiveRescheduleFormId(null);
      setRescheduleSlot("");
      setRescheduleReason("Patient not available at originally scheduled time");
      setRescheduleExplanation("Patient is not available at the scheduled time");
      await loadOrders();
    } catch (err: any) {
      console.error("Rescheduling request failed:", err);
      toast.error(err.message || "Failed to reschedule booking.");
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
                  const isSelected = selectedTests.some((t) => t.id === test.id);
                  return (
                    <div
                      key={test.id}
                      onClick={() => toggleTest(test)}
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
                        <span className="text-xs font-semibold text-orange-600">{test.price}</span>
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
                  <Badge key={t.id} variant="secondary" className="text-xs gap-1 py-1">
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
                  Available 60-Minute Home Collection Windows
                </Label>

                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                    Fetching real-time slots from Orange Health...
                  </div>
                ) : Object.keys(slots).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {Object.entries(slots).map(([slotKey, info]) => {
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
                            {info.is_morning_slot
                              ? "Morning"
                              : info.is_afternoon_slot
                              ? "Afternoon"
                              : "Evening"}
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
              {orders.map((ord) => (
                <Card key={ord.id} className="overflow-hidden">
                  <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{ord.patient_name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            getOrderStatusLabel(ord).toLowerCase().includes("completed")
                              ? "bg-green-500/10 text-green-600 border-green-500/30"
                              : getOrderStatusLabel(ord).toLowerCase().includes("cancelled")
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : "bg-orange-500/10 text-orange-600 border-orange-500/30"
                          }`}
                        >
                          {getOrderStatusLabel(ord)}
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
                      {Object.prototype.hasOwnProperty.call(pendingRescheduleSlots, ord.city_request_id || "") && (
                        <p className="text-[11px] text-orange-600">New time requested. The displayed slot will change after Orange Health confirms it.</p>
                      )}
                      {pendingCancellationIds.includes(ord.city_request_id || "") && (
                        <p className="text-[11px] text-orange-600">Cancellation requested. Waiting for Orange Health confirmation.</p>
                      )}

                      {/* Tests list */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {ord.tests && Array.isArray(ord.tests) && ord.tests.map((t, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px]">
                            {t.name || `Test #${t.test_id || idx + 1}`}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      {ord.report_url ? (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs h-8"
                          onClick={() => window.open(ord.report_url, "_blank")}
                        >
                          <Download className="w-3.5 h-3.5" />
                          View Lab Report
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={checkingResults === ord.id}
                          onClick={() => handleCheckResults(ord)}
                          className="gap-1.5 text-xs h-8"
                        >
                          {checkingResults === ord.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileCheck className="w-3.5 h-3.5" />
                          )}
                          Check Report Status
                        </Button>
                      )}
                      {canManageOrder(ord) && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={cancellingOrderId === ord.id || reschedulingOrderId === ord.id}
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={cancellingOrderId === ord.id || reschedulingOrderId === ord.id}
                            onClick={() => {
                              setActiveRescheduleFormId(ord.id);
                              setRescheduleSlot("");
                            }}
                            className="gap-1.5 text-xs h-8"
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            Reschedule
                          </Button>
                        </>
                      )}
                    </div>
                    {activeRescheduleFormId === ord.id && (
                      <div className="w-full border-t pt-4 mt-2 space-y-3">
                        <h4 className="text-xs font-semibold">Reschedule collection</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">New date and time</Label>
                            <Input
                              type="datetime-local"
                              value={rescheduleSlot}
                              min={getLocalDateTimeInputValue()}
                              onChange={(e) => setRescheduleSlot(e.target.value)}
                              className="text-xs h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Reason</Label>
                            <Input
                              value={rescheduleReason}
                              onChange={(e) => setRescheduleReason(e.target.value)}
                              placeholder="Reason for rescheduling"
                              className="text-xs h-9"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
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
                            disabled={reschedulingOrderId === ord.id}
                            onClick={() => void handleRescheduleOrder(ord)}
                          >
                            {reschedulingOrderId === ord.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit reschedule"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrangeLabTests;
