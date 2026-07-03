import { useEffect, useRef, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { useUserSettings } from "@/hooks/useUserSettings";

/**
 * Checks if the current time falls within the schedule window.
 * Handles overnight ranges like 22:00 → 06:00.
 */
const isInWindow = (from: string, to: string): boolean => {
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
 * Automatically toggles pauseMode between "active", "sleep", and "nap"
 * based on the user's sleep and nap schedules. User can manually override
 * to "active" during sleep/nap hours; that override is respected until
 * the next transition (leaving then re-entering the window).
 */
const useAutoPauseModes = () => {
  const { pauseMode, setPauseMode, loginInProgress } = useApp();
  const { settings } = useUserSettings();
  
  const manualSleepOverrideRef = useRef(false);
  const prevInSleepWindowRef = useRef<boolean | null>(null);

  const manualNapOverrideRef = useRef(false);
  const prevInNapWindowRef = useRef<boolean | null>(null);

  const tick = useCallback(() => {
    if (loginInProgress) return;
    if (pauseMode === "checked-out") return; // don't interfere with check-out

    // Sleep Logic
    const inSleepWindow = settings.sleepMode && settings.sleepSchedule 
      ? isInWindow(settings.sleepSchedule.from, settings.sleepSchedule.to) 
      : false;

    if (prevInSleepWindowRef.current !== null && inSleepWindow && !prevInSleepWindowRef.current) {
      manualSleepOverrideRef.current = false;
    }
    if (prevInSleepWindowRef.current !== null && !inSleepWindow && prevInSleepWindowRef.current) {
      manualSleepOverrideRef.current = false;
      if (pauseMode === "sleep") {
        setPauseMode("active");
      }
    }
    prevInSleepWindowRef.current = inSleepWindow;
    if (inSleepWindow && !manualSleepOverrideRef.current && pauseMode === "active") {
      setPauseMode("sleep");
    }

    // Nap Logic
    const inNapWindow = settings.autoNapMode && settings.napSchedule 
      ? isInWindow(settings.napSchedule.from, settings.napSchedule.to) 
      : false;

    if (prevInNapWindowRef.current !== null && inNapWindow && !prevInNapWindowRef.current) {
      manualNapOverrideRef.current = false;
    }
    if (prevInNapWindowRef.current !== null && !inNapWindow && prevInNapWindowRef.current) {
      manualNapOverrideRef.current = false;
      if (pauseMode === "nap") {
        setPauseMode("active");
      }
    }
    prevInNapWindowRef.current = inNapWindow;
    
    // Nap takes precedence over active, but let's not override sleep if they overlap
    if (inNapWindow && !manualNapOverrideRef.current && pauseMode === "active") {
      setPauseMode("nap");
    }
  }, [pauseMode, setPauseMode, settings.sleepMode, settings.sleepSchedule, settings.autoNapMode, settings.napSchedule, loginInProgress]);

  // Run on mount and every 30 seconds
  useEffect(() => {
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tick]);

  // Detect manual override: if user sets pauseMode to "active" while in window
  useEffect(() => {
    // Sleep override
    const inSleepWindow = settings.sleepMode && settings.sleepSchedule ? isInWindow(settings.sleepSchedule.from, settings.sleepSchedule.to) : false;
    if (inSleepWindow && pauseMode === "active" && prevInSleepWindowRef.current === true) {
      manualSleepOverrideRef.current = true;
    }
    
    // Nap override
    const inNapWindow = settings.autoNapMode && settings.napSchedule ? isInWindow(settings.napSchedule.from, settings.napSchedule.to) : false;
    if (inNapWindow && pauseMode === "active" && prevInNapWindowRef.current === true) {
      manualNapOverrideRef.current = true;
    }
  }, [pauseMode, settings.sleepMode, settings.sleepSchedule, settings.autoNapMode, settings.napSchedule]);
};

export default useAutoPauseModes;
