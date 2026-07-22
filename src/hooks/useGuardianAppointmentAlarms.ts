import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
  playVoiceReminder,
  playLoudAlertSequence,
  showBrowserNotification,
} from "@/lib/audioAlerts";
import {
  showReminderOverlay,
  isOverlayVisible,
  isReminderAcknowledged,
} from "@/components/ReminderOverlay";
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

const PRE_NOTIFICATION_MIN = 5;

interface WardLite {
  userId: string;
  name: string;
}

const useGuardianAppointmentAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { pauseMode, loginInProgress, role } = useApp();
  const firedRef = useRef<Set<string>>(new Set());
  const [wards, setWards] = useState<WardLite[]>([]);

  // Load accepted wards
  useEffect(() => {
    if (role !== "guardian" || !session?.user?.id) {
      setWards([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("guardians")
        .select("user_id")
        .eq("guardian_user_id", session.user.id)
        .eq("status", "accepted");
      if (!data || data.length === 0) {
        if (!cancelled) setWards([]);
        return;
      }
      const ids = data.map((g: any) => g.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      if (cancelled) return;
      setWards(
        ids.map((uid) => ({
          userId: uid,
          name:
            (profiles?.find((p: any) => p.id === uid) as any)?.full_name ||
            "Your ward",
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [role, session?.user?.id]);

  const check = useCallback(async () => {
    if (role !== "guardian") return;
    if (pauseMode !== "active") return;
    if (loginInProgress) return;
    if (settings.guardianAppointmentAlarms === false) return;
    if (!session?.user?.id || wards.length === 0) return;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const wardIds = wards.map((w) => w.userId);
    const { data: appts } = await supabase
      .from("appointments")
      .select("id, user_id, title, start_date, start_time, first_alert, second_alert, alarm_enabled")
      .in("user_id", wardIds)
      .eq("alarm_enabled", true)
      .eq("start_date", todayStr);

    if (!appts || appts.length === 0) return;

    for (const appt of appts as any[]) {
      const ward = wards.find((w) => w.userId === appt.user_id);
      const wardName = ward?.name || "Your ward";
      const [h, m] = appt.start_time.split(":").map(Number);
      const apptTime = new Date(now);
      apptTime.setHours(h, m || 0, 0, 0);

      const alerts = [
        { key: "first", lead: appt.first_alert },
        { key: "second", lead: appt.second_alert },
      ].filter((a) => a.lead && a.lead !== "none");

      for (const alert of alerts) {
        const leadMin = ALERT_LEAD[alert.lead!] ?? 15;
        const alertTime = new Date(apptTime.getTime() - leadMin * 60_000);
        const diffMin = (now.getTime() - alertTime.getTime()) / 60_000;

        const preKey = `g-appt-pre-${dateKey}-${appt.id}-${alert.key}`;
        const popupKey = `g-appt-${dateKey}-${appt.id}-${alert.key}`;

        // T-5 pre-notification
        if (diffMin >= -PRE_NOTIFICATION_MIN && diffMin < 0 && !firedRef.current.has(preKey)) {
          firedRef.current.add(preKey);
          const ts = formatISTDateTime(now);
          if (!isOverlayVisible()) {
            showBrowserNotification(
              "Ward Appointment Reminder",
              `[${ts}] ${wardName}: ${appt.title} starts in ${leadMin + Math.round(-diffMin)} minutes`
            );
          }
        }

        // At alert time: audio + popup
        const slotKey = `g-appt-${dateKey}-${appt.id}-${alert.key}`;
        if (
          diffMin >= 0 &&
          diffMin < 15 &&
          !firedRef.current.has(popupKey) &&
          !isReminderAcknowledged(slotKey)
        ) {
          firedRef.current.add(popupKey);

          const ts = formatISTDateTime(now);
          const message = `[${ts}] ${wardName}: ${appt.title} starts in ${leadMin} minutes`;
          const spoken = `Ward appointment reminder. ${wardName}'s ${appt.title} starts in ${leadMin} minutes.`;

          if (settings.voiceReminders) {
            playVoiceReminder(spoken);
          } else if (settings.audioAlerts) {
            playLoudAlertSequence(spoken);
          }

          if (!isOverlayVisible()) {
            showBrowserNotification("Ward Appointment Reminder", message);
          }

          if (settings.vibration && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }

          showReminderOverlay({
            type: "appointment",
            title: "Ward Appointment",
            message,
            reminderCount: `${appt.start_time}`,
            slotKey,
          });
        }
      }
    }

    // Clean old keys from previous days
    firedRef.current.forEach((k) => {
      if (!k.includes(dateKey)) firedRef.current.delete(k);
    });
  }, [
    role,
    session?.user?.id,
    wards,
    settings.voiceReminders,
    settings.audioAlerts,
    settings.vibration,
    settings.guardianAppointmentAlarms,
    pauseMode,
    loginInProgress,
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

export default useGuardianAppointmentAlarms;
