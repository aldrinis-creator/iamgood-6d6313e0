import { useEffect, useRef } from "react";
import { getAudioMode, playChime, playVoiceReminder } from "@/lib/audioAlerts";

const CHECK_IN_HOURS = [7, 12, 19];

const useCheckInAudio = () => {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = () => {
      const mode = getAudioMode();
      if (mode === "off") return;

      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      for (const h of CHECK_IN_HOURS) {
        const key = `${dateKey}-${h}`;
        // Fire within the first 2 minutes of the check-in hour
        if (hour === h && minute < 2 && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          if (mode === "chime") {
            playChime();
          } else if (mode === "voice") {
            playVoiceReminder("It's time for your Check-iN. Please tap the heart to confirm you're okay.");
          }
        }
      }

      // Clean old keys (keep only today's)
      firedRef.current.forEach((k) => {
        if (!k.startsWith(dateKey)) firedRef.current.delete(k);
      });
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);
};

export default useCheckInAudio;
