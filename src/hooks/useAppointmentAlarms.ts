import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay } from "@/components/ReminderOverlay";

const ALERT_LEAD: Record<string, number> = {
  "5min": 5,
  "10min": 10,
  "15min": 15,
  "30min": 30,
  "1hr": 60,
  "2hr": 120,
  "1day": 1440,
};

const useAppointmentAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode } = useApp();
  const firedRef = useRef<Set<string>>(new Set());

  const check = useCallback(async () => {
    if (pauseMode !== "active") return;
    if (!session?.user?.id) return;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    const { data: appts } = await supabase
      .from("appointments")
      .select("id, title, start_date, start_time, first_alert, second_alert, alarm_enabled")
      .eq("user_id", session.user.id)
      .eq("alarm_enabled", true)
      .eq("start_date", todayStr);

    if (!appts || appts.length === 0) return;

    for (const appt of appts) {
      const [h, m] = appt.start_time.split(":").map(Number);
      const apptTime = new Date(now);
      apptTime.setHours(h, m || 0, 0, 0);

      const alerts = [
        { key: "first", lead: appt.first_alert },
        { key: "second", lead: appt.second_alert },
      ].filter((a) => a.lead);

      for (const alert of alerts) {
        const leadMin = ALERT_LEAD[alert.lead!] ?? 15;
        const alertTime = new Date(apptTime.getTime() - leadMin * 60_000);
        const diffMin = (now.getTime() - alertTime.getTime()) / 60_000;
        const firedKey = `appt-${dateKey}-${appt.id}-${alert.key}`;

        if (diffMin >= 0 && diffMin < 3 && !firedRef.current.has(firedKey)) {
          firedRef.current.add(firedKey);

          const message = `${appt.title} starts in ${leadMin} minutes`;

          if (settings.voiceReminders) {
            playVoiceReminder(message);
          } else if (settings.audioAlerts) {
            playChime();
          }

          if (settings.vibration && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }

          showBrowserNotification("Appointment Reminder", message);

          showReminderOverlay({
            type: "appointment",
            title: "Appointment",
            message,
            reminderCount: `${appt.start_time}`,
          });
        }
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

export default useAppointmentAlarms;
