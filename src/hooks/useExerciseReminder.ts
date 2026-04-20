import { useEffect, useRef, useCallback } from "react";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay, isOverlayVisible, isReminderAcknowledged } from "@/components/ReminderOverlay";
import { formatISTDateTime } from "@/lib/istTime";

const EXERCISE_HOURS = [8, 18];
const EXERCISE_MESSAGE = "Hey, don't forget to undertake your Exercises Activity";
const PRE_ALERT_MIN = 5; // notification fires 5 min before
const POPUP_DELAY_MIN = 5; // popup fires 5 min after

const formatHour = (h: number) => {
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
};

const useExerciseReminder = () => {
  const firedRef = useRef<Set<string>>(new Set());
  const { settings } = useUserSettings();
  const { pauseMode, loginInProgress } = useApp();

  const check = useCallback(() => {
    if (pauseMode !== "active") return;
    if (loginInProgress) return;
    if (!settings.exerciseReminder) return;

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    for (const h of EXERCISE_HOURS) {
      const scheduledAt = new Date(now);
      scheduledAt.setHours(h, 0, 0, 0);
      const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

      const preKey = `exercise-pre-${dateKey}-${h}`;
      const popupKey = `exercise-popup-${dateKey}-${h}`;

      // T-5: Browser notification only (no popup, no audio)
      if (diffMin >= -PRE_ALERT_MIN && diffMin < 0 && !firedRef.current.has(preKey)) {
        firedRef.current.add(preKey);
        const ts = formatISTDateTime(now);
        showBrowserNotification("Exercise Reminder", `[${ts}] ${EXERCISE_MESSAGE} at ${formatHour(h)}`);
      }

      // T+5: Popup overlay (skip if overlay already visible or user acknowledged)
      const slotKey = `exercise-${dateKey}-${h}`;
      if (diffMin >= POPUP_DELAY_MIN && diffMin < POPUP_DELAY_MIN + 5 && !firedRef.current.has(popupKey) && !isReminderAcknowledged(slotKey)) {
        firedRef.current.add(popupKey);
        const ts = formatISTDateTime(now);
        const msgWithTs = `[${ts}] ${EXERCISE_MESSAGE}`;

        if (!isOverlayVisible()) {
          if (settings.voiceReminders) {
            playVoiceReminder(msgWithTs);
          } else if (settings.audioAlerts) {
            playChime();
          }
        }

        if (settings.vibration && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }

        showReminderOverlay({
          type: "exercise",
          title: "Exercise Time",
          message: msgWithTs,
          reminderCount: `Scheduled — ${formatHour(h)}`,
          slotKey,
        });
      }
    }

    // Clean old keys
    firedRef.current.forEach((k) => {
      if (!k.includes(dateKey)) firedRef.current.delete(k);
    });
  }, [pauseMode, settings.voiceReminders, settings.audioAlerts, settings.vibration, settings.exerciseReminder, loginInProgress]);

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
