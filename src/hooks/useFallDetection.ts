import { useEffect, useRef, useState, useCallback } from "react";
import { useUserSettings } from "@/hooks/useUserSettings";

const SENSITIVITY_MAP: Record<string, { freeFall: number; impact: number }> = {
  high: { freeFall: 6, impact: 18 },
  medium: { freeFall: 5, impact: 25 },
  low: { freeFall: 3, impact: 35 },
};

const FREE_FALL_TO_IMPACT_WINDOW = 800; // ms
const COOLDOWN = 30_000;
const COUNTDOWN_SECONDS = 15;

/** Request iOS 13+ DeviceMotion permission. No-op on Android/desktop. */
export async function requestMotionPermission(): Promise<"granted" | "denied" | "not-required"> {
  const DME = DeviceMotionEvent as any;
  if (typeof DME.requestPermission === "function") {
    try {
      const result = await DME.requestPermission();
      return result === "granted" ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }
  // Android / desktop — no permission gate
  return "not-required";
}

export function useFallDetection() {
  const { settings } = useUserSettings();
  const thresholds = SENSITIVITY_MAP[settings.fallSensitivity] || SENSITIVITY_MAP.medium;
  const [fallDetected, setFallDetected] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [permissionState, setPermissionState] = useState<"unknown" | "granted" | "denied">(() => {
    const DME = DeviceMotionEvent as any;
    if (typeof DME.requestPermission !== "function") return "granted";
    if (typeof localStorage !== "undefined" && localStorage.getItem("motion_permission") === "granted") return "granted";
    return "unknown";
  });

  const freeFallTimeRef = useRef<number | null>(null);
  const lastTriggerRef = useRef(0);
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const cancelledRef = useRef(false);

  const enabled = settings.fallDetection;

  const requestPermission = useCallback(async () => {
    const result = await requestMotionPermission();
    if (result === "granted" || result === "not-required") {
      setPermissionState("granted");
      try { localStorage.setItem("motion_permission", "granted"); } catch {}
    } else {
      setPermissionState("denied");
    }
    return result;
  }, []);

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

    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        if (navigator.vibrate) navigator.vibrate(200);
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Auto-request permission on mount when enabled
  useEffect(() => {
    if (enabled && permissionState === "unknown") {
      // Check if permission is needed (iOS) — we can't auto-request without gesture,
      // but we can detect if it's NOT needed (Android/desktop)
      const DME = DeviceMotionEvent as any;
      if (typeof DME.requestPermission !== "function") {
        setPermissionState("granted");
      }
    }
  }, [enabled, permissionState]);

  useEffect(() => {
    if (!enabled || permissionState !== "granted") return;

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
  }, [enabled, permissionState, triggerFallAlert, thresholds]);

  return {
    fallDetected,
    countdown,
    cancelFallAlert,
    countdownExpired: fallDetected && countdown === 0,
    enabled,
    permissionState,
    requestPermission,
  };
}
