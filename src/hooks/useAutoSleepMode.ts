import { useEffect, useRef, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { useUserSettings } from "@/hooks/useUserSettings";

/**
 * Checks if the current time falls within the sleep schedule window.
 * Handles overnight ranges like 22:00 → 06:00.
 */
const isInSleepWindow = (from: string, to: string): boolean => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const fromMin = fh * 60 + fm;
  const toMin = th * 60 + tm;

  if (fromMin <= toMin) {
    // Same-day range (e.g. 13:00 → 15:00)
    return nowMin >= fromMin && nowMin < toMin;
  }
  // Overnight range (e.g. 22:00 → 06:00)
  return nowMin >= fromMin || nowMin < toMin;
};

/**
 * Automatically toggles pauseMode between "active" and "sleep"
 * based on the user's sleep schedule. User can manually override
 * to "active" during sleep hours; that override is respected until
 * the next transition (leaving then re-entering the sleep window).
 */
const useAutoSleepMode = () => {
  const { pauseMode, setPauseMode, loginInProgress } = useApp();
  const { settings } = useUserSettings();
  const manualOverrideRef = useRef(false);
  const prevInWindowRef = useRef<boolean | null>(null);

  const tick = useCallback(() => {
    if (loginInProgress) return;
    if (!settings.sleepMode) return; // user disabled auto-sleep entirely
    if (pauseMode === "checked-out") return; // don't interfere with check-out

    const inWindow = isInSleepWindow(settings.sleepSchedule.from, settings.sleepSchedule.to);

    // Detect transition into sleep window → reset manual override
    if (prevInWindowRef.current !== null && inWindow && !prevInWindowRef.current) {
      manualOverrideRef.current = false;
    }

    // Detect transition out of sleep window → wake up
    if (prevInWindowRef.current !== null && !inWindow && prevInWindowRef.current) {
      manualOverrideRef.current = false;
      if (pauseMode === "sleep") {
        setPauseMode("active");
      }
    }

    prevInWindowRef.current = inWindow;

    if (inWindow && !manualOverrideRef.current && pauseMode === "active") {
      setPauseMode("sleep");
    }
  }, [pauseMode, setPauseMode, settings.sleepMode, settings.sleepSchedule]);

  // Run on mount and every 30 seconds
  useEffect(() => {
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tick]);

  // Detect manual override: if user sets pauseMode to "active" while in sleep window
  useEffect(() => {
    if (!settings.sleepMode) return;
    const inWindow = isInSleepWindow(settings.sleepSchedule.from, settings.sleepSchedule.to);
    if (inWindow && pauseMode === "active" && prevInWindowRef.current === true) {
      manualOverrideRef.current = true;
    }
  }, [pauseMode, settings.sleepMode, settings.sleepSchedule]);
};

export default useAutoSleepMode;
