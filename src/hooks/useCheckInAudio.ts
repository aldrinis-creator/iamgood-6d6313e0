import { useEffect, useRef, useCallback } from "react";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { showReminderOverlay } from "@/components/ReminderOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";

// Guardian notifications are handled exclusively by the server-side
// check-missed-checkins cron. The client only handles user-facing alerts.

const CHECK_IN_HOURS = [7, 12, 19];
const POST_GRACE_INTERVAL_MIN = 10;
const POST_GRACE_MAX_REMINDERS = 3;

const formatHour = (h: number) => {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
};


const useCheckInAudio = () => {
  const firedRef = useRef<Set<string>>(new Set());
  const { settings } = useUserSettings();
  const { session } = useAuth();
  const { pauseMode } = useApp();
  // Track post-grace reminder counts: slotKey → { count, lastFiredAt }
  const postGraceRef = useRef<Map<string, { count: number; lastFiredAt: number }>>(new Map());
  // Track slots where we already sent the final missed notification
  const missedSentRef = useRef<Set<string>>(new Set());

  const fireAlert = useCallback((message: string) => {
    if (settings.voiceReminders) {
      playVoiceReminder(message);
    } else if (settings.audioAlerts) {
      playChime();
    }
    if (settings.vibration && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    showBrowserNotification("Check-iN", message);
  }, [settings.voiceReminders, settings.audioAlerts, settings.vibration]);

  const isCheckInResponded = useCallback(async (windowHour: number, now: Date): Promise<boolean> => {
    if (!session?.user?.id) return false;
    const windowStart = new Date(now);
    windowStart.setHours(windowHour, 0, 0, 0);
    const nextIndex = CHECK_IN_HOURS.indexOf(windowHour) + 1;
    const windowEnd = new Date(now);
    if (nextIndex < CHECK_IN_HOURS.length) {
      windowEnd.setHours(CHECK_IN_HOURS[nextIndex], 0, 0, 0);
    } else {
      windowEnd.setHours(23, 59, 59, 999);
    }

    const { data } = await supabase
      .from("check_ins")
      .select("status")
      .eq("user_id", session.user.id)
      .gte("scheduled_at", windowStart.toISOString())
      .lt("scheduled_at", windowEnd.toISOString())
      .eq("status", "responded")
      .limit(1);

    return !!(data && data.length > 0);
  }, [session?.user?.id]);

  const check = useCallback(async () => {
    if (pauseMode !== "active") return;
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    // --- DUE alerts: fire once at the check-in hour (initial reminder) ---
    for (let i = 0; i < CHECK_IN_HOURS.length; i++) {
      const h = CHECK_IN_HOURS[i];
      const dueKey = `due-${dateKey}-${h}`;
      if (hour === h && minute < 5 && !firedRef.current.has(dueKey)) {
        const responded = await isCheckInResponded(h, now);
        if (!responded) {
          firedRef.current.add(dueKey);
          fireAlert("We hope you are well, Please Check-iN");
          showReminderOverlay({
            type: "checkin",
            title: "Check-In Reminder",
            message: "You haven't checked in yet. Please tap below to let us know you're okay.",
            reminderCount: `Reminder — ${formatHour(h)}`,
          });
        }
      }
    }

    // --- Post-grace escalation: 60+ minutes past check-in hour ---
    for (const h of CHECK_IN_HOURS) {
      const scheduledAt = new Date(now);
      scheduledAt.setHours(h, 0, 0, 0);
      const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;
      const missedKey = `missed-${dateKey}-${h}`;

      if (diffMin >= 60 && diffMin < 1440 && !missedSentRef.current.has(missedKey)) {
        const responded = await isCheckInResponded(h, now);
        if (responded) {
          missedSentRef.current.add(missedKey);
          continue;
        }

        const state = postGraceRef.current.get(missedKey) || { count: 0, lastFiredAt: 0 };
        const minSinceLast = (now.getTime() - state.lastFiredAt) / 60_000;

        if (state.count < POST_GRACE_MAX_REMINDERS && (state.count === 0 || minSinceLast >= POST_GRACE_INTERVAL_MIN)) {
          // Fire a post-grace reminder
          state.count += 1;
          state.lastFiredAt = now.getTime();
          postGraceRef.current.set(missedKey, state);

          fireAlert(`Reminder ${state.count} of ${POST_GRACE_MAX_REMINDERS}: You missed your ${formatHour(h)} Check-iN. Please check in now.`);
          showReminderOverlay({
            type: "checkin",
            title: "Missed Check-In",
            message: `You missed your ${formatHour(h)} Check-iN. Please check in now.`,
            reminderCount: `Reminder ${state.count} of ${POST_GRACE_MAX_REMINDERS} — ${formatHour(h)}`,
          });
        } else if (state.count >= POST_GRACE_MAX_REMINDERS && minSinceLast >= POST_GRACE_INTERVAL_MIN) {
          // All 3 reminders exhausted — final escalation: ONE guardian notification
          missedSentRef.current.add(missedKey);

          // Escalated alert to user
          playVoiceReminder(`You have not checked in after ${POST_GRACE_MAX_REMINDERS} reminders. Your guardians are being notified.`);
          playChime();
          if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);

          showReminderOverlay({
            type: "checkin",
            title: "Check-In Missed",
            message: `You missed your ${formatHour(h)} Check-iN after ${POST_GRACE_MAX_REMINDERS} reminders. Your guardians have been notified.`,
            reminderCount: `Final — ${formatHour(h)}`,
          });

          // Guardian notifications are handled by the server-side cron job
        }
      }
    }

    // Clean old keys
    firedRef.current.forEach((k) => {
      if (!k.includes(dateKey)) firedRef.current.delete(k);
    });
    missedSentRef.current.forEach((k) => {
      if (!k.includes(dateKey)) missedSentRef.current.delete(k);
    });
    postGraceRef.current.forEach((_, k) => {
      if (!k.includes(dateKey)) postGraceRef.current.delete(k);
    });
  }, [pauseMode, fireAlert, isCheckInResponded, session?.user?.id]);

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

export default useCheckInAudio;
