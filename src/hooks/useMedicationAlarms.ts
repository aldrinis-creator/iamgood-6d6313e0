import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChime, playVoiceReminder } from "@/lib/audioAlerts";

const useMedicationAlarms = () => {
  const { session } = useAuth();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = async () => {
      if (!session?.user?.id) return;

      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const currentTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      const { data: meds } = await supabase
        .from("medications")
        .select("id, name, alarm_enabled, alarm_mode, schedule_times")
        .eq("user_id", session.user.id)
        .eq("alarm_enabled", true);

      if (!meds) return;

      for (const med of meds) {
        for (const timeStr of med.schedule_times) {
          const [h] = timeStr.split(":").map(Number);
          const key = `${dateKey}-${med.id}-${timeStr}`;

          // Fire within first 2 minutes of the scheduled hour
          if (h === hour && minute < 2 && !firedRef.current.has(key)) {
            firedRef.current.add(key);

            if (med.alarm_mode === "chime") {
              playChime();
            } else if (med.alarm_mode === "voice") {
              playVoiceReminder(`Time to take ${med.name}`);
            }
          }
        }
      }

      // Clean old keys
      firedRef.current.forEach((k) => {
        if (!k.startsWith(dateKey)) firedRef.current.delete(k);
      });
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);
};

export default useMedicationAlarms;
