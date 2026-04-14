import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay } from "@/components/ReminderOverlay";
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

const POST_GRACE_INTERVAL_MIN = 10;
const POST_GRACE_MAX_REMINDERS = 3;
const POST_GRACE_START_MIN = 30;
const HARD_CUTOFF_MIN = 60;

interface MedInfo {
  id: string;
  name: string;
  dosage: string;
  alarm_mode: string;
  schedule_times: string[];
}

const useMedicationAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode } = useApp();
  const firedRef = useRef<Set<string>>(new Set());
  const postGraceRef = useRef<Map<string, { count: number; lastFiredAt: number }>>(new Map());
  const missedSentRef = useRef<Set<string>>(new Set());

  const check = useCallback(async () => {
    if (pauseMode !== "active") return;
    if (!session?.user?.id) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    const { data: meds } = await supabase
      .from("medications")
      .select("id, name, dosage, alarm_enabled, alarm_mode, schedule_times")
      .eq("user_id", session.user.id)
      .eq("alarm_enabled", true);

    if (!meds || meds.length === 0) return;

    // Phase 1: Collect into batched maps
    const initialSlots = new Map<string, string[]>(); // timeStr → medNames
    const postGraceSlots = new Map<string, string[]>(); // timeStr → medNames (untaken)
    const finalSlots = new Map<string, { names: string[]; medsToLog: Array<{ id: string; scheduledAt: Date }> }>(); 
    const firedMedNames: string[] = [];

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Pre-fetch all medication logs for today to avoid repeated queries
    const medIds = meds.map((m) => m.id);
    const { data: allLogs } = await supabase
      .from("medication_logs")
      .select("id, status, scheduled_at, medication_id")
      .in("medication_id", medIds)
      .eq("user_id", session.user.id)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString());

    const logs = allLogs || [];

    for (const med of meds) {
      for (const timeStr of med.schedule_times) {
        const [h, m] = timeStr.split(":").map(Number);
        const slotKey = `med-slot-${dateKey}-${timeStr}`;
        const missedKey = `missed-${dateKey}-${med.id}-${timeStr}`;

        const scheduledAt = new Date(now);
        scheduledAt.setHours(h, m || 0, 0, 0);
        const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

        // --- Initial alarm (T+0): collect into batch ---
        if (h === hour && (m === undefined ? minute < 10 : Math.abs(minute - (m || 0)) < 10) && !firedRef.current.has(slotKey)) {
          firedRef.current.add(slotKey);
          firedMedNames.push(med.name);

          if (!initialSlots.has(timeStr)) initialSlots.set(timeStr, []);
          initialSlots.get(timeStr)!.push(med.name);
        }

        // --- Post-grace (T+30 to T+60): collect untaken ---
        if (diffMin >= POST_GRACE_START_MIN && diffMin < HARD_CUTOFF_MIN && !missedSentRef.current.has(missedKey)) {
          const takenLog = logs.some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return l.medication_id === med.id && logDate.getHours() === h && logDate.getMinutes() === (m || 0) && l.status === "taken";
          });

          if (takenLog) {
            missedSentRef.current.add(missedKey);
            continue;
          }

          if (!postGraceSlots.has(timeStr)) postGraceSlots.set(timeStr, []);
          postGraceSlots.get(timeStr)!.push(med.name);
        }

        // --- Final escalation (T+60-75): collect for batch ---
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

    // Phase 2: Fire ONE batched alert per time slot

    // --- Initial alarms ---
    const ts = formatISTDateTime(now);
    for (const [timeStr, names] of initialSlots) {
      const combined = names.join(", ");
      if (settings.voiceReminders) {
        playVoiceReminder(`[${ts}] Your medications are due: ${combined}. Remember to take your tablets.`);
      } else if (settings.audioAlerts) {
        playChime();
      }
      if (settings.vibration && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      showBrowserNotification("Medication Reminder", `[${ts}] Time to take: ${combined}`);
      showReminderOverlay({
        type: "medication",
        title: "Medication Reminder",
        message: `[${ts}] Time to take: ${combined}`,
        reminderCount: `Scheduled — ${timeStr}`,
      });
    }

    // --- Post-grace reminders (batched per time slot) ---
    for (const [timeStr, names] of postGraceSlots) {
      const missedKey = `missed-postGrace-${dateKey}-${timeStr}`;
      const state = postGraceRef.current.get(missedKey) || { count: 0, lastFiredAt: 0 };
      const minSinceLast = (now.getTime() - state.lastFiredAt) / 60_000;

      if (state.count < POST_GRACE_MAX_REMINDERS && (state.count === 0 || minSinceLast >= POST_GRACE_INTERVAL_MIN)) {
        state.count += 1;
        state.lastFiredAt = now.getTime();
        postGraceRef.current.set(missedKey, state);

        const combined = names.join(", ");
        if (settings.voiceReminders) {
          playVoiceReminder(`[${ts}] You have not taken your medication: ${combined}. Please take your tablets now.`);
        } else if (settings.audioAlerts) {
          playChime();
        }
        if (settings.vibration && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        showBrowserNotification("Medication Overdue", `[${ts}] Reminder ${state.count} of ${POST_GRACE_MAX_REMINDERS} — ${combined}`);
        showReminderOverlay({
          type: "medication",
          title: "Medication Overdue",
          message: `[${ts}] You have not taken: ${combined}. Please take your tablets now.`,
          reminderCount: `Reminder ${state.count} of ${POST_GRACE_MAX_REMINDERS} — ${timeStr}`,
        });
      }
    }

    // --- Final escalation (batched alert, per-med DB logs) ---
    for (const [timeStr, { names, medsToLog }] of finalSlots) {
      // Insert individual missed logs
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
        playVoiceReminder(`[${ts}] You have not taken your medication after 3 reminders: ${combined}. Please take your tablets now.`);
        playChime();
        if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);

        // Batched guardian notification
        notifyGuardiansMissed(
          session.user.id,
          names,
          medsToLog.map((m) => m.scheduledAt.toISOString())
        );
      }
    }

    // Guardian in-app notifications for initial alarms
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
  }, [session?.user?.id, settings.voiceReminders, settings.audioAlerts, settings.vibration, pauseMode]);

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
