import { useEffect, useRef, useCallback } from "react";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { showReminderOverlay, isOverlayVisible, isReminderAcknowledged } from "@/components/ReminderOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDateTime } from "@/lib/istTime";

// Guardian notifications are handled exclusively by the server-side
// check-missed-checkins cron. The client only handles user-facing alerts.

const CHECK_IN_HOURS = [7, 12, 19];
const PRE_ALERT_MIN = 5; // notification 5 min before
const POPUP_DELAY_MIN = 5; // popup 5 min after
const POPUP_INTERVAL_MIN = 10; // 10 min between popups
const MAX_POPUPS = 3;

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
  const { pauseMode, loginInProgress } = useApp();
  const postGraceRef = useRef<Map<string, { count: number; lastFiredAt: number }>>(new Map());
  const missedSentRef = useRef<Set<string>>(new Set());

  const fireAlert = useCallback((message: string) => {
    if (isOverlayVisible()) return; // skip audio if popup already showing
    if (settings.voiceReminders) {
      playVoiceReminder(message);
    } else if (settings.audioAlerts) {
      playChime();
    }
    if (settings.vibration && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
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
    if (loginInProgress) return;
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    for (const h of CHECK_IN_HOURS) {
      const scheduledAt = new Date(now);
      scheduledAt.setHours(h, 0, 0, 0);
      const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

      const preKey = `checkin-pre-${dateKey}-${h}`;
      const missedKey = `missed-${dateKey}-${h}`;

      // --- Ignore completely if more than 1 hour past scheduled time ---
      if (diffMin >= 60) {
        missedSentRef.current.add(missedKey);
        continue;
      }

      // --- T-5: Browser notification only (no popup, no audio) ---
      if (diffMin >= -PRE_ALERT_MIN && diffMin < 0 && !firedRef.current.has(preKey)) {
        const responded = await isCheckInResponded(h, now);
        if (!responded) {
          firedRef.current.add(preKey);
          const ts = formatISTDateTime(now);
          if (!isOverlayVisible()) {
            showBrowserNotification("Check-iN", `[${ts}] Check-iN due at ${formatHour(h)}`);
          }
        }
      }

      // --- T+5 / T+15 / T+25: Popup overlays 1/3, 2/3, 3/3 ---
      if (diffMin >= POPUP_DELAY_MIN && !missedSentRef.current.has(missedKey)) {
        const responded = await isCheckInResponded(h, now);
        if (responded) {
          missedSentRef.current.add(missedKey);
          continue;
        }

        // Skip if user acknowledged the popup (within 2-min post-action suppression window)
        const slotKey = `checkin-${dateKey}-${h}`;
        if (isReminderAcknowledged(slotKey)) continue;

        const state = postGraceRef.current.get(missedKey) || { count: 0, lastFiredAt: 0 };
        const minSinceLast = (now.getTime() - state.lastFiredAt) / 60_000;

        // Calculate expected trigger times: T+5, T+15, T+25
        const expectedMin = POPUP_DELAY_MIN + state.count * POPUP_INTERVAL_MIN;

        if (state.count < MAX_POPUPS && diffMin >= expectedMin && (state.count === 0 || minSinceLast >= POPUP_INTERVAL_MIN)) {
          state.count += 1;
          state.lastFiredAt = now.getTime();
          postGraceRef.current.set(missedKey, state);

          const ts = formatISTDateTime(now);
          const msg = state.count === 1
            ? `[${ts}] You haven't checked in yet. Please tap below to let us know you're okay.`
            : `[${ts}] You missed your ${formatHour(h)} Check-iN. Please check in now.`;

          fireAlert(msg);
          showReminderOverlay({
            type: "checkin",
            title: state.count === 1 ? "Check-In Reminder" : "Missed Check-In",
            message: msg,
            reminderCount: `Reminder ${state.count} of ${MAX_POPUPS} — ${formatHour(h)}`,
            slotKey: `checkin-${dateKey}-${h}`,
          });
        } else if (state.count >= MAX_POPUPS && minSinceLast >= POPUP_INTERVAL_MIN) {
          // Final escalation
          missedSentRef.current.add(missedKey);

          const tsf = formatISTDateTime(now);
          playVoiceReminder(`[${tsf}] You have not checked in after ${MAX_POPUPS} reminders. Your guardians are being notified.`);
          playChime();
          if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);

          showReminderOverlay({
            type: "checkin",
            title: "Check-In Missed",
            message: `[${tsf}] You missed your ${formatHour(h)} Check-iN after ${MAX_POPUPS} reminders. Your guardians have been notified.`,
            reminderCount: `Final — ${formatHour(h)}`,
          });
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
  }, [pauseMode, fireAlert, isCheckInResponded, session?.user?.id, loginInProgress]);

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
