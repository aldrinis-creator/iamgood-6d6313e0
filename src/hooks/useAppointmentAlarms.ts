import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder, playLoudAlertSequence, showBrowserNotification } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { showReminderOverlay, isOverlayVisible, isReminderAcknowledged } from "@/components/ReminderOverlay";
import { formatISTDateTime } from "@/lib/istTime";

const ALERT_LEAD: Record<string, number> = {
  "5min": 5,
  "10min": 10,
  "15min": 15,
  "30min": 30,
  "1hr": 60,
  "2hr": 120,
  "1day": 1440,
};

const PRE_NOTIFICATION_MIN = 5; // browser notification 5 min before popup

const useAppointmentAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode, loginInProgress } = useApp();
  const firedRef = useRef<Set<string>>(new Set());

  const check = useCallback(async () => {
    if (pauseMode !== "active") return;
    if (loginInProgress) return;
    if (!session?.user?.id) return;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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

        const preKey = `appt-pre-${dateKey}-${appt.id}-${alert.key}`;
        const popupKey = `appt-${dateKey}-${appt.id}-${alert.key}`;

        // T-5 before alert time: browser notification only
        if (diffMin >= -PRE_NOTIFICATION_MIN && diffMin < 0 && !firedRef.current.has(preKey)) {
          firedRef.current.add(preKey);
          const ts = formatISTDateTime(now);
          if (!isOverlayVisible()) {
            showBrowserNotification("Appointment Reminder", `[${ts}] ${appt.title} starts in ${leadMin + Math.round(-diffMin)} minutes`);
          }
        }

        // At alert time: popup overlay
        const slotKey = `appt-${dateKey}-${appt.id}-${alert.key}`;
        if (diffMin >= 0 && diffMin < 15 && !firedRef.current.has(popupKey) && !isReminderAcknowledged(slotKey)) {
          firedRef.current.add(popupKey);

          const ts = formatISTDateTime(now);
          const message = `[${ts}] ${appt.title} starts in ${leadMin} minutes`;
          const spoken = `Appointment reminder. ${appt.title} starts in ${leadMin} minutes.`;

          // Play audio REGARDLESS of overlay visibility
          if (settings.voiceReminders) {
            playVoiceReminder(message);
          } else if (settings.audioAlerts) {
            playLoudAlertSequence(spoken);
          }

          if (!isOverlayVisible()) {
            showBrowserNotification("Appointment Reminder", message);
          }

          if (settings.vibration && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }

          showReminderOverlay({
            type: "appointment",
            title: "Appointment",
            message,
            reminderCount: `${appt.start_time}`,
            slotKey,
          });
        }
      }
    }

    // Clean old keys
    firedRef.current.forEach((k) => {
      if (!k.includes(dateKey)) firedRef.current.delete(k);
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

export default useAppointmentAlarms;
