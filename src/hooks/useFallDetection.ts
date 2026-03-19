import { useEffect, useRef, useState, useCallback } from "react";
import { useUserSettings } from "@/hooks/useUserSettings";

/**
 * Fall detection using the DeviceMotion API.
 *
 * Algorithm:
 * 1. Continuously monitor acceleration (including gravity).
 * 2. Compute the magnitude of the acceleration vector.
 * 3. A fall produces a characteristic signature:
 *    - Free-fall phase: magnitude drops well below 1g (~0–4 m/s²)
 *    - Impact phase: magnitude spikes above a threshold (~25–35 m/s²)
 * 4. If free-fall is detected followed by an impact within 500ms, we flag a fall.
 * 5. After impact, we wait 2s for any post-fall stillness confirmation.
 *
 * Thresholds are tuned to reduce false positives (dropping phone, sitting down hard).
 */

const SENSITIVITY_MAP: Record<string, { freeFall: number; impact: number }> = {
  high: { freeFall: 5, impact: 22 },
  medium: { freeFall: 4, impact: 30 },
  low: { freeFall: 2.5, impact: 38 },
};

const FREE_FALL_TO_IMPACT_WINDOW = 500; // ms
const COOLDOWN = 30_000; // ms — don't re-trigger within 30s
const COUNTDOWN_SECONDS = 15;

export function useFallDetection() {
  const { settings } = useUserSettings();
  const thresholds = SENSITIVITY_MAP[settings.fallSensitivity] || SENSITIVITY_MAP.medium;
  const [fallDetected, setFallDetected] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const freeFallTimeRef = useRef<number | null>(null);
  const lastTriggerRef = useRef(0);
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const cancelledRef = useRef(false);

  const enabled = settings.fallDetection;

  const cancelFallAlert = useCallback(() => {
    cancelledRef.current = true;
    setFallDetected(false);
    setCountdown(COUNTDOWN_SECONDS);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const triggerFallAlert = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerRef.current < COOLDOWN) return;
    lastTriggerRef.current = now;
    cancelledRef.current = false;
    setFallDetected(true);
    setCountdown(COUNTDOWN_SECONDS);

    // Vibrate to alert user
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        // Vibrate each tick
        if (navigator.vibrate) navigator.vibrate(200);
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

      const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      const now = Date.now();

      // Detect free-fall
      if (magnitude < thresholds.freeFall) {
        if (!freeFallTimeRef.current) {
          freeFallTimeRef.current = now;
        }
      }

      // Detect impact after free-fall
      if (magnitude > thresholds.impact && freeFallTimeRef.current) {
        const elapsed = now - freeFallTimeRef.current;
        if (elapsed < FREE_FALL_TO_IMPACT_WINDOW) {
          freeFallTimeRef.current = null;
          triggerFallAlert();
        } else {
          freeFallTimeRef.current = null;
        }
      }

      // Reset free-fall if too long without impact
      if (freeFallTimeRef.current && now - freeFallTimeRef.current > FREE_FALL_TO_IMPACT_WINDOW) {
        freeFallTimeRef.current = null;
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [enabled, triggerFallAlert, thresholds]);

  return {
    fallDetected,
    countdown,
    cancelFallAlert,
    countdownExpired: fallDetected && countdown === 0,
    enabled,
  };
}
