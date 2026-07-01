import raw from "./voDurations.json";

export type VoKey =
  | "s1_hook"
  | "s2_checkin"
  | "s3_meds_sos"
  | "s4_ring"
  | "s5_alerts"
  | "s6_safety"
  | "s7_grid"
  | "s8_outro";

export const VO = raw as Record<VoKey, { text: string; seconds: number }>;

// Trailing breathing room per scene (in seconds), tuned so overall video ~60s.
const TAIL: Record<VoKey, number> = {
  s1_hook: 2.0,
  s2_checkin: 1.6,
  s3_meds_sos: 1.6,
  s4_ring: 1.6,
  s5_alerts: 1.6,
  s6_safety: 1.6,
  s7_grid: 1.6,
  s8_outro: 3.5,
};

const LEAD: Record<VoKey, number> = {
  s1_hook: 0.5,
  s2_checkin: 0.3,
  s3_meds_sos: 0.3,
  s4_ring: 0.3,
  s5_alerts: 0.3,
  s6_safety: 0.3,
  s7_grid: 0.3,
  s8_outro: 0.3,
};

export const FPS = 30;

export const sceneFrames = (key: VoKey): number => {
  const secs = LEAD[key] + VO[key].seconds + TAIL[key];
  return Math.ceil(secs * FPS);
};

export const voStartFrame = (key: VoKey): number => Math.round(LEAD[key] * FPS);

export const SCENE_ORDER: VoKey[] = [
  "s1_hook",
  "s2_checkin",
  "s3_meds_sos",
  "s4_ring",
  "s5_alerts",
  "s6_safety",
  "s7_grid",
  "s8_outro",
];

export const TOTAL_FRAMES = SCENE_ORDER.reduce((acc, k) => acc + sceneFrames(k), 0);
