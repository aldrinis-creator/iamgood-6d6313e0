import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Pill, CalendarClock, X, Dumbbell } from "lucide-react";
import { ensureAudioReady, playVoiceReminder, playChime } from "@/lib/audioAlerts";
import { toast } from "sonner";

export type ReminderType = "checkin" | "medication" | "appointment" | "exercise";

interface ReminderData {
  type: ReminderType;
  title: string;
  message: string;
  reminderCount?: string;
  /** Stable, slot-based key (e.g. "med-2026-3-20-08:00", "checkin-2026-3-20-7"). When provided, dedup uses this instead of message hash. */
  slotKey?: string;
}

// Global event system for triggering reminders
const REMINDER_EVENT = "app:reminder-overlay";

// Global visibility flag for deconfliction — other hooks check this
let _overlayVisible = false;
export const isOverlayVisible = () => _overlayVisible;

const ACK_STORAGE_KEY = "reminder:acknowledged-slots";
const SUPPRESS_STORAGE_KEY = "reminder:suppressed-until";
const POST_ACTION_SUPPRESS_MS = 2 * 60_000; // 2 minutes

const loadAckSet = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

const saveAckSet = (set: Set<string>) => {
  try {
    sessionStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

const loadSuppressMap = (): Map<string, number> => {
  try {
    const raw = sessionStorage.getItem(SUPPRESS_STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, number>));
  } catch {
    return new Map();
  }
};

const saveSuppressMap = (m: Map<string, number>) => {
  try {
    const obj: Record<string, number> = {};
    m.forEach((v, k) => { obj[k] = v; });
    sessionStorage.setItem(SUPPRESS_STORAGE_KEY, JSON.stringify(obj));
  } catch {}
};

/** Check if a slot is currently acknowledged or within the post-action suppression window. */
export const isReminderAcknowledged = (slotKey: string): boolean => {
  if (!slotKey) return false;
  const ack = loadAckSet();
  if (ack.has(slotKey)) return true;
  const supp = loadSuppressMap();
  const until = supp.get(slotKey);
  if (until && until > Date.now()) return true;
  return false;
};

/** Manually clear an acknowledgement (e.g. when medication log flips to taken — slot naturally resolved). */
export const clearReminderAcknowledgement = (slotKey: string) => {
  const ack = loadAckSet();
  if (ack.delete(slotKey)) saveAckSet(ack);
  const supp = loadSuppressMap();
  if (supp.delete(slotKey)) saveSuppressMap(supp);
};

export const showReminderOverlay = (data: ReminderData) => {
  // Hard guard: if already acknowledged or suppressed, swallow the event entirely.
  if (data.slotKey && isReminderAcknowledged(data.slotKey)) return;
  window.dispatchEvent(new CustomEvent(REMINDER_EVENT, { detail: data }));
};

const AUTO_DISMISS_MS = 10_000; // 10 seconds
const REPEAT_INTERVAL_MS = 5 * 60_000; // 5 minutes
// 4 = the new on-time (T+0) bubble plus the three follow-up nudges (T+5/T+15/T+25)
const MAX_SHOWS = 4;

const getReminderKey = (data: ReminderData) =>
  data.slotKey || `${data.type}:${data.title}:${data.message}`;

// Module-scoped so the counter survives ReminderOverlay re-mounts
// (AppLayout tears it down whenever loginInProgress or role branches change).
const showCounts = new Map<string, number>();

const ReminderOverlay = () => {
  const navigate = useNavigate();
  const [reminder, setReminder] = useState<ReminderData | null>(null);
  const [visible, setVisible] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout>>();
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback((acknowledged: boolean = false) => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setVisible(false);
    _overlayVisible = false;

    if (acknowledged && reminder) {
      const key = getReminderKey(reminder);
      showCounts.delete(key);
      const ack = loadAckSet();
      ack.add(key);
      saveAckSet(ack);
      // Post-action suppression window
      const supp = loadSuppressMap();
      supp.set(key, Date.now() + POST_ACTION_SUPPRESS_MS);
      saveSuppressMap(supp);
    }

    setTimeout(() => setReminder(null), 300);
  }, [reminder]);

  const scheduleRepeat = useCallback((data: ReminderData) => {
    if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current);
    repeatTimerRef.current = setTimeout(() => {
      const key = getReminderKey(data);
      if (loadAckSet().has(key)) return;
      const supp = loadSuppressMap();
      const until = supp.get(key);
      if (until && until > Date.now()) return;
      showReminderOverlay(data);
    }, REPEAT_INTERVAL_MS);
  }, []);

  const handleEvent = useCallback((e: Event) => {
    const data = (e as CustomEvent<ReminderData>).detail;
    const key = getReminderKey(data);

    // If already acknowledged or in suppression window, don't show
    if (loadAckSet().has(key)) return;
    const supp = loadSuppressMap();
    const until = supp.get(key);
    if (until && until > Date.now()) return;

    const count = (showCounts.get(key) || 0) + 1;
    showCounts.set(key, count);

    if (count > MAX_SHOWS) {
      // Escalation
      if (data.type === "medication") {
        playVoiceReminder("You have not taken your medication after 3 reminders. Please take your tablets now.");
        playChime();
        if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
        toast.warning("Medication not taken — your guardian will be notified.", { duration: 6000 });
      } else {
        toast.info("Maximum reminders reached. Please take action.");
      }
      showCounts.delete(key);
      return;
    }

    setReminder(data);
    setVisible(true);
    _overlayVisible = true;
    ensureAudioReady();

    // Auto-dismiss after 30 seconds
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    autoDismissRef.current = setTimeout(() => {
      setVisible(false);
      _overlayVisible = false;
      setTimeout(() => setReminder(null), 300);
      // Schedule next repeat if not at max
      if (count < MAX_SHOWS) {
        scheduleRepeat(data);
      }
    }, AUTO_DISMISS_MS);
  }, [scheduleRepeat]);

  useEffect(() => {
    window.addEventListener(REMINDER_EVENT, handleEvent);
    return () => {
      window.removeEventListener(REMINDER_EVENT, handleEvent);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current);
    };
  }, [handleEvent]);

  // No manual dismiss — only action button or auto-dismiss stops the overlay

  const handleDismiss = () => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setVisible(false);
    _overlayVisible = false;
    setTimeout(() => setReminder(null), 300);
    // Schedule next repeat if under max shows
    if (reminder) {
      const key = getReminderKey(reminder);
      const count = showCounts.get(key) || 1;
      if (count < MAX_SHOWS) {
        scheduleRepeat(reminder);
      }
    }
  };

  const handleAction = () => {
    ensureAudioReady();
    const target = reminder?.type;
    dismiss(true); // acknowledged + 2-min suppression
    if (target === "checkin") {
      window.dispatchEvent(new CustomEvent("app:checkin-from-overlay"));
    } else if (target === "medication") {
      navigate("/my-health?tool=Tablets");
    } else if (target === "appointment") {
      navigate("/appointments");
    } else if (target === "exercise") {
      navigate("/my-health");
    }
  };

  if (!reminder) return null;

  const isCheckin = reminder.type === "checkin";
  const isAppointment = reminder.type === "appointment";
  const isExercise = reminder.type === "exercise";
  const Icon = isCheckin ? Heart : isAppointment ? CalendarClock : isExercise ? Dumbbell : Pill;

  const actionLabel = isCheckin
    ? "Check-In Now"
    : isAppointment
    ? "View Appointment"
    : isExercise
    ? "Log Activity"
    : "View Medications";

  const key = getReminderKey(reminder);
  const currentShow = showCounts.get(key) || 1;

  return (
    <div
      onClick={handleDismiss}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Round bubble — tap anywhere on it to dismiss */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleDismiss}
        className={`relative aspect-square w-[80vw] max-w-[20rem] rounded-full bg-background shadow-2xl border-4 border-destructive/60 flex flex-col items-center justify-center text-center px-8 gap-2 cursor-pointer select-none transition-all duration-300 animate-[pulse_1.6s_cubic-bezier(0.4,0,0.6,1)_infinite] ${
          visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        {/* Soft flashing halo */}
        <span className="pointer-events-none absolute inset-0 rounded-full bg-destructive/10 animate-ping" />

        <Icon className="w-14 h-14 text-destructive fill-destructive" />
        <h2 className="text-2xl font-bold text-destructive leading-tight">{reminder.title}</h2>
        <p className="text-lg text-foreground leading-snug line-clamp-3">
          {reminder.message}
        </p>

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAction();
          }}
          className="mt-1 px-6 py-3 rounded-full bg-destructive text-destructive-foreground text-lg font-bold flex items-center justify-center gap-2 hover:bg-destructive/90 transition-colors active:scale-[0.98]"
        >
          <Icon className="w-6 h-6 fill-current" />
          {actionLabel}
        </button>

        <p className="text-xs text-muted-foreground">
          {reminder.reminderCount ?? `Reminder ${currentShow} of ${MAX_SHOWS}`}
          {" · Tap to close"}
        </p>
      </div>
    </div>
  );

};

export default ReminderOverlay;
