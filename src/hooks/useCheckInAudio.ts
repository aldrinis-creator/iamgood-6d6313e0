import { useEffect, useRef } from "react";
import { playChime, playVoiceReminder } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { showReminderOverlay } from "@/components/ReminderOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CHECK_IN_HOURS = [7, 12, 19];

const formatHour = (h: number) => {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
};

const useCheckInAudio = () => {
  const firedRef = useRef<Set<string>>(new Set());
  const { settings } = useUserSettings();
  const { session } = useAuth();

  useEffect(() => {
    const fireAlert = (message: string) => {
      if (settings.voiceReminders) {
        playVoiceReminder(message);
      } else if (settings.audioAlerts) {
        playChime();
      }
      if (settings.vibration && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    };

    const check = async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      // --- DUE alerts: fire within first 5 minutes of check-in hour ---
      for (const h of CHECK_IN_HOURS) {
        const dueKey = `due-${dateKey}-${h}`;
        if (hour === h && minute < 5 && !firedRef.current.has(dueKey)) {
          // Check if already responded
          const responded = await isCheckInResponded(h, now);
          if (!responded) {
            firedRef.current.add(dueKey);
            fireAlert("We hope you are well, Please Check-iN");
            toast("Time for your Check-iN! 💓", {
              description: "We hope you are well. Please tap the heart to check in.",
              duration: 10000,
            });
          }
        }
      }

      // --- MISSED alerts: 30+ min past check-in hour with no response ---
      for (const h of CHECK_IN_HOURS) {
        const missedKey = `missed-${dateKey}-${h}`;
        // Check if we're 30-59 min past the check-in hour
        if (hour === h && minute >= 30 && !firedRef.current.has(missedKey)) {
          const responded = await isCheckInResponded(h, now);
          if (!responded) {
            firedRef.current.add(missedKey);
            fireAlert(`You missed your ${formatHour(h)} Check-iN. Please check in now.`);
            toast.warning(`Missed Check-iN: ${formatHour(h)}`, {
              description: "You haven't checked in yet. Your guardians will be notified.",
              duration: 15000,
            });
          }
        }
      }

      // Clean old keys (keep only today's)
      firedRef.current.forEach((k) => {
        if (!k.includes(dateKey)) firedRef.current.delete(k);
      });
    };

    const isCheckInResponded = async (windowHour: number, now: Date): Promise<boolean> => {
      if (!session?.user?.id) return false;
      const windowStart = new Date(now);
      windowStart.setHours(windowHour, 0, 0, 0);
      const nextIndex = CHECK_IN_HOURS.indexOf(windowHour) + 1;
      const windowEnd = new Date(now);
      if (nextIndex < CHECK_IN_HOURS.length) {
        windowEnd.setHours(CHECK_IN_HOURS[nextIndex], 0, 0, 0);
      } else {
        windowEnd.setHours(23, 59, 59, 999);
      }

      const { data } = await supabase
        .from("check_ins")
        .select("status")
        .eq("user_id", session.user.id)
        .gte("scheduled_at", windowStart.toISOString())
        .lt("scheduled_at", windowEnd.toISOString())
        .eq("status", "responded")
        .limit(1);

      return !!(data && data.length > 0);
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [settings.audioAlerts, settings.voiceReminders, settings.vibration, session?.user?.id]);
};

export default useCheckInAudio;
