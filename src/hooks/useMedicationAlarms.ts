import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay, isOverlayVisible, isReminderAcknowledged, clearReminderAcknowledgement } from "@/components/ReminderOverlay";
import { formatISTDateTime } from "@/lib/istTime";

const notifyGuardiansMissed = async (userId: string, medNames: string[], scheduledTimes: string[]) => {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    await fetch(`https://${projectId}.supabase.co/functions/v1/notify-guardian-medication`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ user_id: userId, medication_name: medNames.join(", "), status: "missed", scheduled_time: scheduledTimes[0] }),
    });
  } catch {
    // best-effort
  }
};

const PRE_ALERT_MIN = 5; // browser notification 5 min before
const POPUP_DELAY_MIN = 5; // first popup 5 min after scheduled time
const POPUP_INTERVAL_MIN = 10; // 10 min between popups (T+5, T+15, T+25)
const MAX_POPUPS = 3;
const HARD_CUTOFF_MIN = 60;

const useMedicationAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode, loginInProgress } = useApp();
  const firedRef = useRef<Set<string>>(new Set());
  const postGraceRef = useRef<Map<string, { count: number; lastFiredAt: number }>>(new Map());
  const missedSentRef = useRef<Set<string>>(new Set());

  const check = useCallback(async () => {
    if (pauseMode !== "active") return;
    if (loginInProgress) return;
    if (!session?.user?.id) return;

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    const { data: meds } = await supabase
      .from("medications")
      .select("id, name, dosage, alarm_enabled, alarm_mode, schedule_times")
      .eq("user_id", session.user.id)
      .eq("alarm_enabled", true);

    if (!meds || meds.length === 0) return;

    // Pre-fetch all medication logs for today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const medIds = meds.map((m) => m.id);
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
    const preAlertSlots = new Map<string, string[]>(); // T-5 notification
    const popupSlots = new Map<string, string[]>(); // T+5/+15/+25 popups
    const finalSlots = new Map<string, { names: string[]; medsToLog: Array<{ id: string; scheduledAt: Date }> }>();
    const firedMedNames: string[] = [];

    for (const med of meds) {
      for (const timeStr of med.schedule_times) {
        const [h, m] = timeStr.split(":").map(Number);
        const scheduledAt = new Date(now);
        scheduledAt.setHours(h, m || 0, 0, 0);
        const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

        const preKey = `med-pre-${dateKey}-${timeStr}`;
        const missedKey = `missed-${dateKey}-${med.id}-${timeStr}`;

        // --- T-5: Browser notification only ---
        if (diffMin >= -PRE_ALERT_MIN && diffMin < 0 && !firedRef.current.has(preKey)) {
          if (!preAlertSlots.has(timeStr)) preAlertSlots.set(timeStr, []);
          preAlertSlots.get(timeStr)!.push(med.name);
        }

        // --- T+5 to T+35: Popup reminders 1/3, 2/3, 3/3 ---
        if (diffMin >= POPUP_DELAY_MIN && diffMin < HARD_CUTOFF_MIN && !missedSentRef.current.has(missedKey)) {
          const takenLog = logs.some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return l.medication_id === med.id && logDate.getHours() === h && logDate.getMinutes() === (m || 0) && (l.status === "taken" || l.status === "taken_late");
          });

          if (takenLog) {
            missedSentRef.current.add(missedKey);
            // Slot resolved naturally — clear any lingering acknowledgement
            clearReminderAcknowledgement(`med-${dateKey}-${timeStr}`);
            continue;
          }

          // Skip if user already acknowledged this slot's popup (within suppression window)
          const slotKey = `med-${dateKey}-${timeStr}`;
          if (isReminderAcknowledged(slotKey)) continue;

          if (!popupSlots.has(timeStr)) popupSlots.set(timeStr, []);
          popupSlots.get(timeStr)!.push(med.name);
        }

        // --- Final escalation (T+60): log missed + guardian notify ---
        if (diffMin >= HARD_CUTOFF_MIN && diffMin < HARD_CUTOFF_MIN + 15 && !missedSentRef.current.has(missedKey)) {
          const alreadyTaken = logs.some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return l.medication_id === med.id && logDate.getHours() === h && logDate.getMinutes() === (m || 0) && (l.status === "taken" || l.status === "taken_late");
          });

          if (alreadyTaken) {
            missedSentRef.current.add(missedKey);
            continue;
          }

          const alreadyMissedLog = logs.some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return l.medication_id === med.id && logDate.getHours() === h && logDate.getMinutes() === (m || 0) && l.status === "missed";
          });

          missedSentRef.current.add(missedKey);

          if (!finalSlots.has(timeStr)) finalSlots.set(timeStr, { names: [], medsToLog: [] });
          const slot = finalSlots.get(timeStr)!;
          slot.names.push(med.name);

          if (!alreadyMissedLog) {
            slot.medsToLog.push({ id: med.id, scheduledAt });
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
        if (!isOverlayVisible()) {
          showBrowserNotification("Medication Coming Up", `[${ts}] ${combined} due at ${timeStr}`);
        }
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

      if (state.count < MAX_POPUPS && diffMin >= expectedMin && (state.count === 0 || minSinceLast >= POPUP_INTERVAL_MIN)) {
        state.count += 1;
        state.lastFiredAt = now.getTime();
        postGraceRef.current.set(graceKey, state);

        const combined = names.join(", ");
        firedMedNames.push(...names);

        if (!isOverlayVisible()) {
          if (settings.voiceReminders) {
            playVoiceReminder(`[${ts}] ${state.count === 1 ? "Your medications are due" : "You have not taken your medication"}: ${combined}. ${state.count === 1 ? "Remember to take your tablets." : "Please take your tablets now."}`);
          } else if (settings.audioAlerts) {
            playChime();
          }
        }

        if (settings.vibration && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }

        showReminderOverlay({
          type: "medication",
          title: state.count === 1 ? "Medication Reminder" : "Medication Overdue",
          message: `[${ts}] ${state.count === 1 ? "Time to take" : "You have not taken"}: ${combined}`,
          reminderCount: `Reminder ${state.count} of ${MAX_POPUPS} — ${timeStr}`,
          slotKey: `med-${dateKey}-${timeStr}`,
        });
      }
    }

    // --- Final escalation (batched) ---
    for (const [timeStr, { names, medsToLog }] of finalSlots) {
      for (const { id, scheduledAt } of medsToLog) {
        await supabase.from("medication_logs").insert({
          medication_id: id,
          user_id: session.user.id,
          scheduled_at: scheduledAt.toISOString(),
          status: "missed",
        });
      }

      if (medsToLog.length > 0) {
        const combined = names.join(", ");
        playVoiceReminder(`[${ts}] You have not taken your medication after ${MAX_POPUPS} reminders: ${combined}. Please take your tablets now.`);
        playChime();
        if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);

        notifyGuardiansMissed(
          session.user.id,
          names,
          medsToLog.map((ml) => ml.scheduledAt.toISOString())
        );
      }
    }

    // Guardian in-app notifications for initial popup
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
  }, [session?.user?.id, settings.voiceReminders, settings.audioAlerts, settings.vibration, pauseMode, loginInProgress]);

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
