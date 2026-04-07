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
const BUFFER_DURATION_MS = 3000; // 3 seconds of pre-impact data
const POST_IMPACT_WINDOW_MS = 2000; // 2 seconds of post-impact data
const SAMPLE_INTERVAL_MS = 20; // ~50Hz
const BUFFER_SIZE = Math.ceil(BUFFER_DURATION_MS / SAMPLE_INTERVAL_MS); // ~150 samples
const STILLNESS_THRESHOLD = 2.0; // magnitude variance below this = still
const ORIENTATION_CHANGE_THRESHOLD = 30; // degrees
const CONFIDENCE_TRIGGER = 0.6; // minimum confidence to trigger alert

interface MotionSample {
  t: number;
  x: number;
  y: number;
  z: number;
  mag: number;
}

/** Circular buffer for motion data */
class CircularBuffer {
  private data: MotionSample[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.data = new Array(capacity);
  }

  push(sample: MotionSample) {
    this.data[this.head] = sample;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getAll(): MotionSample[] {
    if (this.count === 0) return [];
    const result: MotionSample[] = [];
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      result.push(this.data[(start + i) % this.capacity]);
    }
    return result;
  }

  clear() {
    this.count = 0;
    this.head = 0;
  }
}

/**
 * Analyze a motion signature for fall characteristics.
 * Returns a confidence score 0–1.
 * 
 * Fall pattern: gradual tilt → free-fall (low magnitude) → sharp impact (high magnitude) → stillness
 * Dropped phone: sudden spike only, no preceding free-fall, often followed by bouncing/movement
 */
function analyzeFallSignature(
  preSamples: MotionSample[],
  postSamples: MotionSample[],
  thresholds: { freeFall: number; impact: number }
): number {
  if (preSamples.length < 10) return 0;

  let score = 0;

  // 1. Check for free-fall phase in pre-impact data (last 800ms before impact)
  const impactTime = preSamples[preSamples.length - 1]?.t || 0;
  const freeFallSamples = preSamples.filter(
    (s) => s.mag < thresholds.freeFall && impactTime - s.t < FREE_FALL_TO_IMPACT_WINDOW
  );
  const freeFallDurationMs = freeFallSamples.length * SAMPLE_INTERVAL_MS;
  if (freeFallDurationMs > 80) score += 0.25; // At least ~80ms of free-fall
  if (freeFallDurationMs > 200) score += 0.1; // Extended free-fall

  // 2. Check for orientation change (tilt before fall)
  // Compare first quarter vs last quarter of pre-impact buffer
  const quarterLen = Math.floor(preSamples.length / 4);
  if (quarterLen > 2) {
    const earlyAvg = avgVector(preSamples.slice(0, quarterLen));
    const lateAvg = avgVector(preSamples.slice(-quarterLen));
    const angleDeg = angleBetweenVectors(earlyAvg, lateAvg);
    if (angleDeg > ORIENTATION_CHANGE_THRESHOLD) score += 0.2;
    if (angleDeg > 60) score += 0.1;
  }

  // 3. Check impact magnitude (already detected, but score by severity)
  const maxMag = Math.max(...preSamples.slice(-10).map((s) => s.mag));
  if (maxMag > thresholds.impact * 1.5) score += 0.1;

  // 4. Check post-impact stillness
  if (postSamples.length > 5) {
    const postMags = postSamples.map((s) => s.mag);
    const postMean = postMags.reduce((a, b) => a + b, 0) / postMags.length;
    const postVariance = postMags.reduce((a, m) => a + (m - postMean) ** 2, 0) / postMags.length;
    
    // Low variance around ~9.8 (gravity) = person lying still
    if (postVariance < STILLNESS_THRESHOLD) score += 0.25;
    // Moderate variance = phone bouncing (dropped phone)
    if (postVariance > 10) score -= 0.2;
  }

  // 5. Check for "bounce" pattern (dropped phone bounces, person doesn't)
  if (postSamples.length > 10) {
    const spikes = postSamples.filter((s) => s.mag > thresholds.impact * 0.5).length;
    if (spikes > 3) score -= 0.3; // Multiple post-impact spikes = bouncing object
  }

  return Math.max(0, Math.min(1, score));
}

function avgVector(samples: MotionSample[]): { x: number; y: number; z: number } {
  const n = samples.length;
  if (n === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: samples.reduce((a, s) => a + s.x, 0) / n,
    y: samples.reduce((a, s) => a + s.y, 0) / n,
    z: samples.reduce((a, s) => a + s.z, 0) / n,
  };
}

function angleBetweenVectors(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const magA = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
  const magB = Math.sqrt(b.x ** 2 + b.y ** 2 + b.z ** 2);
  if (magA === 0 || magB === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

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
  return "not-required";
}

export function useFallDetection() {
  const { settings } = useUserSettings();
  const thresholds = SENSITIVITY_MAP[settings.fallSensitivity] || SENSITIVITY_MAP.medium;
  const [fallDetected, setFallDetected] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [fallConfidence, setFallConfidence] = useState(0);
  const [permissionState, setPermissionState] = useState<"unknown" | "granted" | "denied">(() => {
    const DME = DeviceMotionEvent as any;
    if (typeof DME.requestPermission !== "function") return "granted";
    if (typeof localStorage !== "undefined" && localStorage.getItem("motion_permission") === "granted") return "granted";
    return "unknown";
  });

  const bufferRef = useRef(new CircularBuffer(BUFFER_SIZE));
  const postImpactRef = useRef<MotionSample[]>([]);
  const collectingPostImpactRef = useRef(false);
  const impactTimeRef = useRef<number | null>(null);
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
    setFallConfidence(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const triggerFallAlert = useCallback((confidence: number) => {
    const now = Date.now();
    if (now - lastTriggerRef.current < COOLDOWN) return;
    lastTriggerRef.current = now;
    cancelledRef.current = false;
    setFallDetected(true);
    setFallConfidence(confidence);
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
      const DME = DeviceMotionEvent as any;
      if (typeof DME.requestPermission !== "function") {
        setPermissionState("granted");
      }
    }
  }, [enabled, permissionState]);

  useEffect(() => {
    if (!enabled || permissionState !== "granted") return;

    const buffer = bufferRef.current;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

      const now = Date.now();
      const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      const sample: MotionSample = { t: now, x: acc.x, y: acc.y, z: acc.z, mag: magnitude };

      // If collecting post-impact data, add to post-impact buffer
      if (collectingPostImpactRef.current && impactTimeRef.current) {
        postImpactRef.current.push(sample);
        if (now - impactTimeRef.current >= POST_IMPACT_WINDOW_MS) {
          // Post-impact collection complete — analyze full signature
          collectingPostImpactRef.current = false;
          const preSamples = buffer.getAll();
          const postSamples = postImpactRef.current;
          const confidence = analyzeFallSignature(preSamples, postSamples, thresholds);

          if (confidence >= CONFIDENCE_TRIGGER) {
            triggerFallAlert(confidence);
          }

          postImpactRef.current = [];
          impactTimeRef.current = null;
          freeFallTimeRef.current = null;
        }
        return;
      }

      // Add to circular buffer
      buffer.push(sample);

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
          // Impact detected — start collecting post-impact data
          impactTimeRef.current = now;
          collectingPostImpactRef.current = true;
          postImpactRef.current = [sample];
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
    fallConfidence,
  };
}
