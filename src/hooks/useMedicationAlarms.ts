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

const useMedicationAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode } = useApp();
  const firedRef = useRef<Set<string>>(new Set());
  const missedFiredRef = useRef<Set<string>>(new Set());

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

        // --- Current-time alarm (fires once) ---
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

        // --- Missed-dose detection (60+ minutes past) ---
        const scheduledAt = new Date(now);
        scheduledAt.setHours(h, m || 0, 0, 0);
        const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;
        const missedKey = `missed-${dateKey}-${med.id}-${timeStr}`;

        if (diffMin >= 60 && diffMin < 1440 && !missedFiredRef.current.has(missedKey)) {
          missedFiredRef.current.add(missedKey);

          // Check if a log already exists for this slot (any status — don't overwrite "taken")
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

          // Match by hour/minute instead of exact ISO string
          const hasLog = (existingLogs || []).some((l) => {
            const logDate = new Date(l.scheduled_at ?? "");
            return logDate.getHours() === h && logDate.getMinutes() === (m || 0);
          });

          if (!hasLog) {
            // Write missed record
            await supabase.from("medication_logs").insert({
              medication_id: med.id,
              user_id: session.user.id,
              scheduled_at: scheduledAt.toISOString(),
              status: "missed",
            });

            // Notify guardians
            notifyGuardiansMissed(session.user.id, med.name, scheduledAt.toISOString());
          }
        }
      }
    }

    // Notify guardians if any alarms fired
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
    missedFiredRef.current.forEach((k) => {
      if (!k.includes(dateKey)) missedFiredRef.current.delete(k);
    });
  }, [session?.user?.id, settings.voiceReminders, settings.audioAlerts, settings.vibration, pauseMode]);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Listen for snooze-exhausted escalation from ReminderOverlay
    const onSnoozeExhausted = () => {
      if (session?.user?.id) {
        // Notify guardians immediately about missed medication
        notifyGuardiansMissed(session.user.id, "Medication (snooze exhausted)", new Date().toISOString());
      }
    };
    window.addEventListener("app:medication-snooze-exhausted", onSnoozeExhausted);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("app:medication-snooze-exhausted", onSnoozeExhausted);
    };
  }, [check, session?.user?.id]);
};

export default useMedicationAlarms;
