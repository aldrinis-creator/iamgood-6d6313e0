import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay } from "@/components/ReminderOverlay";

const useMedicationAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode } = useApp();
  const firedRef = useRef<Set<string>>(new Set());

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

        if (h === hour && (m === undefined ? minute < 2 : Math.abs(minute - (m || 0)) < 2) && !firedRef.current.has(slotKey) && !slotsFired.has(slotKey)) {
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
        await supabase.from("notifications").insert(notifications);
      }
    }

    // Clean old keys
    firedRef.current.forEach((k) => {
      if (!k.includes(dateKey)) firedRef.current.delete(k);
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
