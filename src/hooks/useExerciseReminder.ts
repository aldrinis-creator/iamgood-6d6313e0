import { useEffect, useRef, useCallback } from "react";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay } from "@/components/ReminderOverlay";

const EXERCISE_HOURS = [8, 18];
const EXERCISE_MESSAGE = "Hey, don't forget to undertake your Exercises Activity";

const formatHour = (h: number) => {
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
};

const useExerciseReminder = () => {
  const firedRef = useRef<Set<string>>(new Set());
  const { settings } = useUserSettings();
  const { pauseMode } = useApp();

  const check = useCallback(() => {
    if (pauseMode !== "active") return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    for (const h of EXERCISE_HOURS) {
      const key = `exercise-${dateKey}-${h}`;
      if (hour === h && minute < 5 && !firedRef.current.has(key)) {
        firedRef.current.add(key);

        if (settings.voiceReminders) {
          playVoiceReminder(EXERCISE_MESSAGE);
        } else if (settings.audioAlerts) {
          playChime();
        }

        if (settings.vibration && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }

        showBrowserNotification("Exercise Reminder", EXERCISE_MESSAGE);

        showReminderOverlay({
          type: "exercise",
          title: "Exercise Time",
          message: EXERCISE_MESSAGE,
          reminderCount: `Scheduled — ${formatHour(h)}`,
        });
      }
    }

    // Clean old keys
    firedRef.current.forEach((k) => {
      if (!k.includes(dateKey)) firedRef.current.delete(k);
    });
  }, [pauseMode, settings.voiceReminders, settings.audioAlerts, settings.vibration]);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);
};

export default useExerciseReminder;
