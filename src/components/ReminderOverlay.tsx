import { useState, useEffect, useCallback, useRef } from "react";
import { Heart, Pill, CalendarClock, AlarmClock, X, Dumbbell } from "lucide-react";
import { ensureAudioReady } from "@/lib/audioAlerts";
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

const SNOOZE_MS = 5 * 60_000; // 5 minutes
const MAX_SNOOZES = 3;

const getReminderKey = (data: ReminderData) => `${data.type}:${data.title}:${data.message}`;

const ReminderOverlay = () => {
  const [reminder, setReminder] = useState<ReminderData | null>(null);
  const [visible, setVisible] = useState(false);
  const [snoozesLeft, setSnoozesLeft] = useState(MAX_SNOOZES);
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const snoozeCountRef = useRef<Map<string, number>>(new Map());

  const handleEvent = useCallback((e: Event) => {
    const data = (e as CustomEvent<ReminderData>).detail;
    const key = getReminderKey(data);
    const used = snoozeCountRef.current.get(key) || 0;
    setSnoozesLeft(MAX_SNOOZES - used);
    setReminder(data);
    setVisible(true);
    ensureAudioReady();
  }, []);

  useEffect(() => {
    window.addEventListener(REMINDER_EVENT, handleEvent);
    return () => {
      window.removeEventListener(REMINDER_EVENT, handleEvent);
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, [handleEvent]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setReminder(null), 300);
  };

  const handleSnooze = () => {
    if (!reminder) return;
    const key = getReminderKey(reminder);
    const used = (snoozeCountRef.current.get(key) || 0) + 1;
    snoozeCountRef.current.set(key, used);

    if (used >= MAX_SNOOZES) {
      toast.info("Maximum snoozes reached. Please take action.");
      dismiss();
      return;
    }

    const snoozedReminder = { ...reminder };
    dismiss();
    snoozeTimerRef.current = setTimeout(() => {
      showReminderOverlay(snoozedReminder);
    }, SNOOZE_MS);
  };

  const handleAction = () => {
    ensureAudioReady(); // Re-prime for future alerts
    if (reminder?.type === "checkin") {
      window.dispatchEvent(new CustomEvent("app:checkin-from-overlay"));
    } else if (reminder?.type === "medication") {
      window.location.href = "/my-health";
    } else if (reminder?.type === "appointment") {
      window.location.href = "/appointments";
    } else if (reminder?.type === "exercise") {
      window.location.href = "/my-health";
    }
    dismiss();
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
        </div>

        {/* Action Button */}
        <button
          onClick={handleAction}
          className="w-full py-6 rounded-2xl bg-destructive text-destructive-foreground text-2xl font-bold flex items-center justify-center gap-3 hover:bg-destructive/90 transition-colors active:scale-[0.98] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        >
          <Icon className="w-8 h-8 fill-current" />
          {actionLabel}
        </button>

        {/* Snooze + Dismiss row */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={handleSnooze}
            className="flex items-center gap-2 text-lg font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <AlarmClock className="w-5 h-5" />
            Snooze 5 min
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            onClick={dismiss}
            className="flex items-center gap-2 text-lg font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderOverlay;
