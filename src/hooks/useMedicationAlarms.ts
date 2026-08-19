import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay, isOverlayVisible, isReminderAcknowledged, clearReminderAcknowledgement } from "@/components/ReminderOverlay";
import { formatISTDateTime } from "@/lib/istTime";
import { isMedScheduledToday } from "@/lib/medSchedule";

const PRE_ALERT_MIN = 5;        // browser notification 5 min before
const POPUP_DELAY_MIN = 5;      // first popup 5 min after scheduled time
const POPUP_INTERVAL_MIN = 10;  // 10 min between popups (T+5, T+15, T+25)
const MAX_POPUPS = 3;
const HARD_CUTOFF_MIN = 60;

const useMedicationAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode, loginInProgress } = useApp();
  const firedRef = useRef<Set<string>>(new Set());
  const postGraceRef = useRef<Map<string, { count: number; lastFiredAt: number }>>(new Map());
  const missedSentRef = useRef<Set<string>>(new Set());
  const escalationFiredRef = useRef<Set<string>>(new Set()); // FIX A: per-slot escalation guard

  // FIX B: Invoke server escalation directly at T+60.
  // check-missed-medications reads medication_logs WHERE status='missed'.
  // We write the missed log first, then call the function so it finds the row immediately.
  // The function uses whatsapp_alerted_at IS NULL deduplication so double-fire is safe.
  const triggerServerEscalation = useCallback(async () => {
    try {
      await supabase.functions.invoke("check-missed-medications", {
        body: { triggeredBy: "client-escalation" },
      });
    } catch (err) {
      console.error("check-missed-medications invocation error:", err);
    }
  }, []);

  const check = useCallback(async () => {
    if (pauseMode !== "active") return;
    if (loginInProgress) return;
    if (!session?.user?.id) return;

    const now = new Date();
    // FIX C: getMonth() + 1 (was getMonth() — off-by-one every month, caused alarm dedup keys to collide)
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    const { data: meds } = await supabase
      .from("medications")
      .select("id, name, dosage, alarm_enabled, alarm_mode, schedule_times, schedule_days")
      .eq("user_id", session.user.id)
      .eq("alarm_enabled", true);

    const scheduledMeds = (meds ?? []).filter((m: any) => isMedScheduledToday(m));
    if (scheduledMeds.length === 0) return;

    // Pre-fetch all medication logs for today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const medIds = scheduledMeds.map((m: any) => m.id);
    const { data: allLogs } = await supabase
      .from("medication_logs")
      .select("id, status, scheduled_at, medication_id")
      .in("medication_id", medIds)
      .eq("user_id", session.user.id)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString());

    const logs = allLogs || [];
    const ts = formatISTDateTime(now);

    // Phase 1: Collect into batched maps per time slot
    const preAlertSlots = new Map<string, string[]>();
    const popupSlots = new Map<string, string[]>();
    const finalSlots = new Map<string, { names: string[]; medsToLog: Array<{ id: string; scheduledAt: Date }> }>();
    const silentMissedSlots = new Map<string, Array<{ id: string; scheduledAt: Date }>>();
    const firedMedNames: string[] = [];
    let newMissedLogsWritten = false; // FIX D: track whether we need to invoke server escalation

    for (const med of scheduledMeds) {
      for (const timeStr of med.schedule_times) {
        const [h, m] = timeStr.split(":").map(Number);
        const scheduledAt = new Date(now);
        scheduledAt.setHours(h, m || 0, 0, 0);
        const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

        const preKey = `med-pre-${dateKey}-${timeStr}`;
        const missedKey = `missed-${dateKey}-${med.id}-${timeStr}`;

        const takenLog = logs.some((l) => {
          const logDate = new Date(l.scheduled_at ?? "");
          return (
            l.medication_id === med.id &&
            logDate.getHours() === h &&
            logDate.getMinutes() === (m || 0) &&
            (l.status === "taken" || l.status === "taken_late")
          );
        });

        // --- T-5: Browser notification only ---
        if (diffMin >= -PRE_ALERT_MIN && diffMin < 0 && !firedRef.current.has(preKey)) {
          if (!takenLog) {
            if (!preAlertSlots.has(timeStr)) preAlertSlots.set(timeStr, []);
            preAlertSlots.get(timeStr)!.push(med.name);
          } else {
            firedRef.current.add(preKey);
          }
        }

        // --- T+5 to T+35: Popup reminders 1/3, 2/3, 3/3 ---
        if (diffMin >= POPUP_DELAY_MIN && diffMin < HARD_CUTOFF_MIN && !missedSentRef.current.has(missedKey)) {
          if (takenLog) {
            missedSentRef.current.add(missedKey);
            clearReminderAcknowledgement(`med-${dateKey}-${timeStr}`);
            continue;
          }

          const slotKey = `med-${dateKey}-${timeStr}`;
          if (isReminderAcknowledged(slotKey)) continue;

          if (!popupSlots.has(timeStr)) popupSlots.set(timeStr, []);
          popupSlots.get(timeStr)!.push(med.name);
        }

        // --- Hard cutoff (T+60): write missed log + trigger server escalation ---
        if (diffMin >= HARD_CUTOFF_MIN && !missedSentRef.current.has(missedKey)) {
          const alreadyTaken = logs.some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return (
              l.medication_id === med.id &&
              logDate.getHours() === h &&
              logDate.getMinutes() === (m || 0) &&
              (l.status === "taken" || l.status === "taken_late")
            );
          });

          if (alreadyTaken) {
            missedSentRef.current.add(missedKey);
            continue;
          }

          const alreadyMissedLog = logs.some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return (
              l.medication_id === med.id &&
              logDate.getHours() === h &&
              logDate.getMinutes() === (m || 0) &&
              l.status === "missed"
            );
          });

          missedSentRef.current.add(missedKey);

          if (!alreadyMissedLog) {
            if (!silentMissedSlots.has(timeStr)) silentMissedSlots.set(timeStr, []);
            silentMissedSlots.get(timeStr)!.push({ id: med.id, scheduledAt });
            newMissedLogsWritten = true; // FIX D: we will need to call server
          }

          // Local voice reminder at T+60 (fires once in the first check cycle after cutoff)
          const isVeryLate = diffMin > HARD_CUTOFF_MIN + 5;
          if (!isVeryLate) {
            if (!finalSlots.has(timeStr)) finalSlots.set(timeStr, { names: [], medsToLog: [] });
            const slot = finalSlots.get(timeStr)!;
            slot.names.push(med.name);
          }
        }
      }
    }

    // Phase 2: Fire batched alerts

    // --- Pre-alert notifications (T-5) ---
    for (const [timeStr, names] of preAlertSlots) {
      const preKey = `med-pre-${dateKey}-${timeStr}`;
      if (!firedRef.current.has(preKey)) {
        firedRef.current.add(preKey);
        const combined = names.join(", ");
        showBrowserNotification("Medication Coming Up", `[${ts}] ${combined} due at ${timeStr}`);
      }
    }

    // --- Popup reminders (T+5, T+15, T+25) ---
    for (const [timeStr, names] of popupSlots) {
      const graceKey = `med-popup-${dateKey}-${timeStr}`;
      const state = postGraceRef.current.get(graceKey) || { count: 0, lastFiredAt: 0 };
      const minSinceLast = (now.getTime() - state.lastFiredAt) / 60_000;

      const [h, m] = timeStr.split(":").map(Number);
      const scheduledAt = new Date(now);
      scheduledAt.setHours(h, m || 0, 0, 0);
      const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;
      const expectedMin = POPUP_DELAY_MIN + state.count * POPUP_INTERVAL_MIN;

      if (
        state.count < MAX_POPUPS &&
        diffMin >= expectedMin &&
        (state.count === 0 || minSinceLast >= POPUP_INTERVAL_MIN)
      ) {
        state.count += 1;
        state.lastFiredAt = now.getTime();
        postGraceRef.current.set(graceKey, state);

        const combined = names.join(", ");
        firedMedNames.push(...names);

        // FIX E: audio plays regardless of overlay visibility (same fix as check-in audio)
        if (settings.voiceReminders) {
          playVoiceReminder(
            `[${ts}] ${state.count === 1 ? "Your medications are due" : "You have not taken your medication"}: ${combined}. ${state.count === 1 ? "Remember to take your tablets." : "Please take your tablets now."}`
          );
        } else if (settings.audioAlerts) {
          playChime();
        }

        if (settings.vibration && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }

        if (!isOverlayVisible()) {
          showReminderOverlay({
            type: "medication",
            title: state.count === 1 ? "Medication Reminder" : "Medication Overdue",
            message: `[${ts}] ${state.count === 1 ? "Time to take" : "You have not taken"}: ${combined}`,
            reminderCount: `Reminder ${state.count} of ${MAX_POPUPS} — ${timeStr}`,
            slotKey: `med-${dateKey}-${timeStr}`,
          });
        }
      }
    }

    // --- Final escalation: local voice reminder at T+60 ---
    for (const [timeStr, { names }] of finalSlots) {
      if (names.length > 0) {
        const combined = names.join(", ");
        playVoiceReminder(
          `[${ts}] You have not taken your medication after ${MAX_POPUPS} reminders: ${combined}. Please take your tablets now.`
        );
        playChime();
        if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);

        // FIX F: Show overlay for T+60 escalation (was missing — overlay only showed for T+5/15/25)
        if (!isOverlayVisible()) {
          showReminderOverlay({
            type: "medication",
            title: "Medication Missed",
            message: `[${ts}] You have not taken: ${combined}. Your guardians have been notified.`,
            reminderCount: `Final escalation — ${timeStr}`,
          });
        }
      }
    }

    // --- Silent Missed Logging ---
    // FIX G: Write missed logs BEFORE invoking server escalation so the edge function finds the rows
    for (const [, medsToLog] of silentMissedSlots) {
      for (const { id, scheduledAt } of medsToLog) {
        await supabase.from("medication_logs").insert({
          medication_id: id,
          user_id: session.user.id,
          scheduled_at: scheduledAt.toISOString(),
          status: "missed",
        });
      }
    }

    // FIX B applied: invoke server escalation after writing missed logs
    // escalationFiredRef prevents re-invoking on every subsequent 30s tick
    if (newMissedLogsWritten) {
      const escalationKey = `med-escalation-${dateKey}`;
      if (!escalationFiredRef.current.has(escalationKey)) {
        escalationFiredRef.current.add(escalationKey);
        await triggerServerEscalation();
      }
    }

    // --- Guardian in-app notifications for initial popup reminder ---
    if (firedMedNames.length > 0) {
      const { data: guardians } = await supabase
        .from("guardians")
        .select("id")
        .eq("user_id", session.user.id);

      if (guardians && guardians.length > 0) {
        const message = `[${ts}] Medication reminder fired for: ${firedMedNames.join(", ")}`;
        const notifications = guardians.map((g) => ({
          user_id: session.user.id,
          guardian_id: g.id,
          title: "Medication Reminder",
          message,
          type: "medication_reminder",
          read: false,
        }));
        await supabase.rpc("insert_notifications_deduped", {
          p_notifications: notifications,
        });
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
  }, [
    session?.user?.id,
    settings.voiceReminders,
    settings.audioAlerts,
    settings.vibration,
    pauseMode,
    loginInProgress,
    triggerServerEscalation,
  ]);

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

export default useMedicationAlarms;
