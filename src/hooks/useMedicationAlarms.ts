import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { toast } from "sonner";

const useMedicationAlarms = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = async () => {
      if (!session?.user?.id) return;

      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      const { data: meds } = await supabase
        .from("medications")
        .select("id, name, alarm_enabled, alarm_mode, schedule_times")
        .eq("user_id", session.user.id)
        .eq("alarm_enabled", true);

      if (!meds || meds.length === 0) return;

      // Group by time-slot so we only fire ONE alert per slot
      const slotsFired = new Set<string>();

      for (const med of meds) {
        for (const timeStr of med.schedule_times) {
          const [h, m] = timeStr.split(":").map(Number);
          const slotKey = `med-slot-${dateKey}-${timeStr}`;

          // Fire within first 2 minutes of scheduled time
          if (h === hour && (m === undefined ? minute < 2 : Math.abs(minute - (m || 0)) < 2) && !firedRef.current.has(slotKey) && !slotsFired.has(slotKey)) {
            slotsFired.add(slotKey);
            firedRef.current.add(slotKey);

            // Fire the consolidated voice/chime alert once per time-slot
            if (settings.voiceReminders) {
              playVoiceReminder("Your Medications are due. Remember to take your tablets");
            } else if (settings.audioAlerts) {
              playChime();
            }

            if (settings.vibration && navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }

            toast("Medication Reminder 💊", {
              description: "Your medications are due. Remember to take your tablets.",
              duration: 10000,
            });
          }
        }
      }

      // Clean old keys
      firedRef.current.forEach((k) => {
        if (!k.includes(dateKey)) firedRef.current.delete(k);
      });
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [session?.user?.id, settings.voiceReminders, settings.audioAlerts, settings.vibration]);
};

export default useMedicationAlarms;
