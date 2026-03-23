import { useState, useEffect, useCallback } from "react";
import { Heart, Pill, CalendarClock, X } from "lucide-react";

export type ReminderType = "checkin" | "medication" | "appointment";

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

const ReminderOverlay = () => {
  const [reminder, setReminder] = useState<ReminderData | null>(null);
  const [visible, setVisible] = useState(false);

  const handleEvent = useCallback((e: Event) => {
    const data = (e as CustomEvent<ReminderData>).detail;
    setReminder(data);
    setVisible(true);
  }, []);

  useEffect(() => {
    window.addEventListener(REMINDER_EVENT, handleEvent);
    return () => window.removeEventListener(REMINDER_EVENT, handleEvent);
  }, [handleEvent]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setReminder(null), 300);
  };

  const handleAction = () => {
    if (reminder?.type === "checkin") {
      window.dispatchEvent(new CustomEvent("app:checkin-from-overlay"));
    } else if (reminder?.type === "medication") {
      window.location.href = "/my-health";
    }
    dismiss();
  };

  if (!reminder) return null;

  const isCheckin = reminder.type === "checkin";
  const Icon = isCheckin ? Heart : Pill;

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
          {isCheckin ? "Check-In Now" : "View Medications"}
        </button>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="flex items-center justify-center gap-2 mx-auto text-lg font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-6 h-6" />
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ReminderOverlay;
