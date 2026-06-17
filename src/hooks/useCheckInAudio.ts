import { useEffect, useRef, useCallback } from "react";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { showReminderOverlay, isOverlayVisible, isReminderAcknowledged } from "@/components/ReminderOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDateTime } from "@/lib/istTime";
import { canFireCheckInAudio, getCheckInAudioKey, MAX_AUDIO_ALERTS } from "@/lib/checkInAudioLimiter";

// Guardian WhatsApp/Email/Push notifications are triggered server-side via the
// check-missed-checkins edge function, which is scheduled by pg_cron (see migration).
// The client invokes it directly at escalation time as a belt-and-suspenders measure
// in case the cron fires between intervals.

const CHECK_IN_HOURS = [7, 12, 19];
const PRE_ALERT_MIN = 5;       // browser notification 5 min before
const POPUP_DELAY_MIN = 5;     // first popup 5 min after scheduled time
const POPUP_INTERVAL_MIN = 10; // 10 min between popups
const MAX_POPUPS = MAX_AUDIO_ALERTS;
// FIX 1: T-0 audio window widened from [0, POPUP_DELAY_MIN) to [0, POPUP_DELAY_MIN + POPUP_INTERVAL_MIN)
// so the chime still fires even if the 30s polling loop first catches the alarm at T+1..T+14.
const DUE_AUDIO_WINDOW_MIN = POPUP_DELAY_MIN + POPUP_INTERVAL_MIN; // 15 min

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
  const { pauseMode, loginInProgress, userName } = useApp();
  const postGraceRef = useRef<Map<string, { count: number; lastFiredAt: number }>>(new Map());
  const missedSentRef = useRef<Set<string>>(new Set());
  const escalationFiredRef = useRef<Set<string>>(new Set()); // FIX 2: separate guard for escalation invoke
  const runningRef = useRef<boolean>(false); // re-entry guard against concurrent check() invocations

  // FIX 3: fireAlert no longer silently drops audio when overlay is already visible.
  // Instead it always plays audio (the overlay and audio are independent concerns)
  // and only skips showing a SECOND overlay on top of an existing one.
  const fireAlert = useCallback((message: string, skipOverlayCheck = false) => {
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

  // FIX 4: triggerServerEscalation calls the edge function directly at escalation time.
  // pg_cron also runs it on schedule — the edge function uses deduped inserts so
  // double-invocation is safe and only one set of notifications is ever delivered.
  const triggerServerEscalation = useCallback(async (checkInId?: string) => {
    try {
      await supabase.functions.invoke("check-missed-checkins", {
        body: { triggeredBy: "client-escalation", checkInId },
      });
    } catch (err) {
      console.error("check-missed-checkins invocation error:", err);
    }
  }, []);

  const tryFireAudio = useCallback((key: string, msg: string) => {
    if (!canFireCheckInAudio(key, MAX_POPUPS)) return false;
    fireAlert(msg);
    return true;
  }, [fireAlert]);

  const check = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
    if (pauseMode !== "active") return;
    if (loginInProgress) return;
    const now = new Date();
    // FIX 5: getMonth() + 1 (was getMonth() — off-by-one every month)
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    for (const h of CHECK_IN_HOURS) {
      const scheduledAt = new Date(now);
      scheduledAt.setHours(h, 0, 0, 0);
      const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

      const preKey = `checkin-pre-${dateKey}-${h}`;
      const missedKey = `missed-${dateKey}-${h}`;
      const escalationKey = `escalation-${dateKey}-${h}`;
      const audioKey = getCheckInAudioKey("user", session?.user?.id || "unknown", scheduledAt);

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
          showBrowserNotification("Check-iN", `[${ts}] Check-iN due at ${formatHour(h)}`);
        }
      }

      // --- T-0: Initial alarm — fires within a 15-min window after scheduled time ---
      // FIX 1 applied: window is now [0, DUE_AUDIO_WINDOW_MIN) = [0, 15) minutes
      // so first-time alert still fires even if polling loop first runs at T+1..T+14
      const dueKey = `checkin-due-${dateKey}-${h}`;
      if (diffMin >= 0 && diffMin < DUE_AUDIO_WINDOW_MIN && !firedRef.current.has(dueKey)) {
        const responded = await isCheckInResponded(h, now);
        if (!responded) {
          firedRef.current.add(dueKey);
          const msg = `Hey ${userName || "there"}, it's time to Check in and let your people know you are well. Have a nice day!`;
          tryFireAudio(audioKey, msg);
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

          tryFireAudio(audioKey, msg);
          if (!isOverlayVisible()) {
            showReminderOverlay({
              type: "checkin",
              title: state.count === 1 ? "Check-In Reminder" : "Missed Check-In",
              message: msg,
              reminderCount: `Reminder ${state.count} of ${MAX_POPUPS} — ${formatHour(h)}`,
              slotKey: `checkin-${dateKey}-${h}`,
            });
          }
        } else if (state.count >= MAX_POPUPS && minSinceLast >= POPUP_INTERVAL_MIN) {
          // Final escalation — T+35: NO audio (hard cap at MAX_POPUPS), overlay + server only
          missedSentRef.current.add(missedKey);

          const tsf = formatISTDateTime(now);

          if (!isOverlayVisible()) {
            showReminderOverlay({
              type: "checkin",
              title: "Check-In Missed",
              message: `[${tsf}] You missed your ${formatHour(h)} Check-iN after ${MAX_POPUPS} reminders. Your guardians have been notified.`,
              reminderCount: `Final — ${formatHour(h)}`,
            });
          }

          // FIX 4 applied: Trigger server-side guardian notifications directly.
          // The edge function uses insert_notifications_deduped so double-fire (client + cron) is safe.
          if (!escalationFiredRef.current.has(escalationKey)) {
            escalationFiredRef.current.add(escalationKey);
            await triggerServerEscalation();
          }
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
    escalationFiredRef.current.forEach((k) => {
      if (!k.includes(dateKey)) escalationFiredRef.current.delete(k);
    });
    } finally {
      runningRef.current = false;
    }
  }, [pauseMode, fireAlert, tryFireAudio, isCheckInResponded, loginInProgress, userName, triggerServerEscalation]);

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
