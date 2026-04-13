import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay } from "@/components/ReminderOverlay";

const notifyGuardiansMissed = async (userId: string, medName: string, scheduledTime: string) => {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    await fetch(`https://${projectId}.supabase.co/functions/v1/notify-guardian-medication`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ user_id: userId, medication_name: medName, status: "missed", scheduled_time: scheduledTime }),
    });
  } catch {
    // best-effort
  }
};

const POST_GRACE_INTERVAL_MIN = 10;
const POST_GRACE_MAX_REMINDERS = 3;
const POST_GRACE_START_MIN = 30;
const HARD_CUTOFF_MIN = 60;

const useMedicationAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode } = useApp();
  const firedRef = useRef<Set<string>>(new Set());
  // Track post-grace reminder counts: slotKey → { count, lastFiredAt }
  const postGraceRef = useRef<Map<string, { count: number; lastFiredAt: number }>>(new Map());
  // Track slots where we already sent the final missed SMS
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

    const slotsFired = new Set<string>();
    const firedMedNames: string[] = [];

    for (const med of meds) {
      for (const timeStr of med.schedule_times) {
        const [h, m] = timeStr.split(":").map(Number);
        const slotKey = `med-slot-${dateKey}-${timeStr}`;
        const missedKey = `missed-${dateKey}-${med.id}-${timeStr}`;

        const scheduledAt = new Date(now);
        scheduledAt.setHours(h, m || 0, 0, 0);
        const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

        // --- Current-time alarm (fires once at scheduled time) ---
        if (h === hour && (m === undefined ? minute < 10 : Math.abs(minute - (m || 0)) < 10) && !firedRef.current.has(slotKey) && !slotsFired.has(slotKey)) {
          slotsFired.add(slotKey);
          firedRef.current.add(slotKey);
          firedMedNames.push(med.name);

          if (settings.voiceReminders) {
            playVoiceReminder("Your Medications are due. Remember to take your tablets");
          } else if (settings.audioAlerts) {
            playChime();
          }

          if (settings.vibration && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }

          showBrowserNotification("Medication Reminder", "Your medications are due. Remember to take your tablets.");

          showReminderOverlay({
            type: "medication",
            title: "Medication Reminder",
            message: "Your medications are due. Remember to take your tablets.",
            reminderCount: `Scheduled — ${timeStr}`,
          });
        }

        // --- Post-grace escalation (30-60 minutes past, hard stop at 60) ---
        if (diffMin >= POST_GRACE_START_MIN && diffMin < HARD_CUTOFF_MIN && !missedSentRef.current.has(missedKey)) {
          // Check if medication was already taken
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(now);
          todayEnd.setHours(23, 59, 59, 999);

          const { data: existingLogs } = await supabase
            .from("medication_logs")
            .select("id, status, scheduled_at")
            .eq("medication_id", med.id)
            .eq("user_id", session.user.id)
            .gte("scheduled_at", todayStart.toISOString())
            .lte("scheduled_at", todayEnd.toISOString());

          const takenLog = (existingLogs || []).some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return logDate.getHours() === h && logDate.getMinutes() === (m || 0) && l.status === "taken";
          });

          if (takenLog) {
            // Already taken — skip
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

            if (settings.voiceReminders) {
              playVoiceReminder("You have not taken your medication. Please take your tablets now.");
            } else if (settings.audioAlerts) {
              playChime();
            }
            if (settings.vibration && navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }

            showBrowserNotification("Medication Overdue", `Reminder ${state.count} of ${POST_GRACE_MAX_REMINDERS} — please take your medication.`);

            showReminderOverlay({
              type: "medication",
              title: "Medication Overdue",
              message: "You have not taken your medication. Please take your tablets now.",
              reminderCount: `Reminder ${state.count} of ${POST_GRACE_MAX_REMINDERS} — ${timeStr}`,
            });
          }
        }

        // --- Final escalation at 60-min mark (fires once, window 60–75 min) ---
        if (diffMin >= HARD_CUTOFF_MIN && diffMin < HARD_CUTOFF_MIN + 15 && !missedSentRef.current.has(missedKey)) {
          const todayStart2 = new Date(now);
          todayStart2.setHours(0, 0, 0, 0);
          const todayEnd2 = new Date(now);
          todayEnd2.setHours(23, 59, 59, 999);

          const { data: finalLogs } = await supabase
            .from("medication_logs")
            .select("id, status, scheduled_at")
            .eq("medication_id", med.id)
            .eq("user_id", session.user.id)
            .gte("scheduled_at", todayStart2.toISOString())
            .lte("scheduled_at", todayEnd2.toISOString());

          const alreadyTaken = (finalLogs || []).some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return logDate.getHours() === h && logDate.getMinutes() === (m || 0) && (l.status === "taken" || l.status === "taken_late");
          });

          if (alreadyTaken) {
            missedSentRef.current.add(missedKey);
            continue;
          }

          // Durable guard: if a "missed" log already exists, skip SMS (handles page refreshes)
          const alreadyMissedLog = (finalLogs || []).some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return logDate.getHours() === h && logDate.getMinutes() === (m || 0) && l.status === "missed";
          });

          missedSentRef.current.add(missedKey);

          if (!alreadyMissedLog) {
            await supabase.from("medication_logs").insert({
              medication_id: med.id,
              user_id: session.user.id,
              scheduled_at: scheduledAt.toISOString(),
              status: "missed",
            });

            // Only play final escalation audio + notify guardians when this is the first time
            playVoiceReminder("You have not taken your medication after 3 reminders. Please take your tablets now.");
            playChime();
            if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);

            notifyGuardiansMissed(session.user.id, med.name, scheduledAt.toISOString());
          }
        }
        // Beyond 75 min: NO more alerts fire
      }
    }

    // Notify guardians if any initial alarms fired (in-app notification only)
    if (firedMedNames.length > 0) {
      const { data: guardians } = await supabase
        .from("guardians")
        .select("id")
        .eq("user_id", session.user.id);

      if (guardians && guardians.length > 0) {
        const message = `Medication reminder fired for: ${firedMedNames.join(", ")}`;
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
