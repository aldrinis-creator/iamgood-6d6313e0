import { useState, useEffect, useCallback, useRef } from "react";
import { Heart, Pill, CalendarClock, X, Dumbbell } from "lucide-react";
import { ensureAudioReady, playVoiceReminder, playChime } from "@/lib/audioAlerts";
import { toast } from "sonner";

export type ReminderType = "checkin" | "medication" | "appointment" | "exercise";

interface ReminderData {
  type: ReminderType;
  title: string;
  message: string;
  reminderCount?: string;
}

// Global event system for triggering reminders
const REMINDER_EVENT = "app:reminder-overlay";

export const showReminderOverlay = (data: ReminderData) => {
  window.dispatchEvent(new CustomEvent(REMINDER_EVENT, { detail: data }));
};

const AUTO_DISMISS_MS = 30_000; // 30 seconds
const REPEAT_INTERVAL_MS = 5 * 60_000; // 5 minutes
const MAX_SHOWS = 3;

const getReminderKey = (data: ReminderData) => `${data.type}:${data.title}:${data.message}`;

const ReminderOverlay = () => {
  const [reminder, setReminder] = useState<ReminderData | null>(null);
  const [visible, setVisible] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout>>();
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const showCountRef = useRef<Map<string, number>>(new Map());
  const acknowledgedRef = useRef<Set<string>>(new Set());

  const dismiss = useCallback((acknowledged: boolean = false) => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setVisible(false);

    if (acknowledged && reminder) {
      acknowledgedRef.current.add(getReminderKey(reminder));
    }

    setTimeout(() => setReminder(null), 300);
  }, [reminder]);

  const scheduleRepeat = useCallback((data: ReminderData) => {
    if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current);
    repeatTimerRef.current = setTimeout(() => {
      const key = getReminderKey(data);
      if (acknowledgedRef.current.has(key)) return;
      showReminderOverlay(data);
    }, REPEAT_INTERVAL_MS);
  }, []);

  const handleEvent = useCallback((e: Event) => {
    const data = (e as CustomEvent<ReminderData>).detail;
    const key = getReminderKey(data);

    // If already acknowledged, don't show again
    if (acknowledgedRef.current.has(key)) return;

    const count = (showCountRef.current.get(key) || 0) + 1;
    showCountRef.current.set(key, count);

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
      showCountRef.current.delete(key);
      return;
    }

    setReminder(data);
    setVisible(true);
    ensureAudioReady();

    // Auto-dismiss after 30 seconds
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    autoDismissRef.current = setTimeout(() => {
      setVisible(false);
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
    setTimeout(() => setReminder(null), 300);
    // Schedule next repeat if under max shows
    if (reminder) {
      const key = getReminderKey(reminder);
      const count = showCountRef.current.get(key) || 1;
      if (count < MAX_SHOWS) {
        scheduleRepeat(reminder);
      }
    }
  };

  const handleAction = () => {
    ensureAudioReady();
    dismiss(true); // acknowledged
    if (reminder?.type === "checkin") {
      window.dispatchEvent(new CustomEvent("app:checkin-from-overlay"));
    } else if (reminder?.type === "medication") {
      window.location.href = "/my-health?tool=Tablets";
    } else if (reminder?.type === "appointment") {
      window.location.href = "/appointments";
    } else if (reminder?.type === "exercise") {
      window.location.href = "/my-health";
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
  const currentShow = showCountRef.current.get(key) || 1;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`bg-background rounded-3xl shadow-2xl w-[90%] max-w-sm mx-auto p-8 text-center space-y-6 transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Icon + Title */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Icon className="w-10 h-10 text-destructive fill-destructive" />
            <h2 className="text-3xl font-bold text-destructive">{reminder.title}</h2>
          </div>
          <p className="text-xl text-foreground leading-relaxed">
            {reminder.message}
          </p>
          {reminder.reminderCount && (
            <p className="text-lg text-muted-foreground font-medium">
              {reminder.reminderCount}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Reminder {currentShow} of {MAX_SHOWS} · Auto-closes in 30s
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleAction}
          className="w-full py-6 rounded-2xl bg-destructive text-destructive-foreground text-2xl font-bold flex items-center justify-center gap-3 hover:bg-destructive/90 transition-colors active:scale-[0.98] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        >
          <Icon className="w-8 h-8 fill-current" />
          {actionLabel}
        </button>

      </div>
    </div>
  );
};

export default ReminderOverlay;
