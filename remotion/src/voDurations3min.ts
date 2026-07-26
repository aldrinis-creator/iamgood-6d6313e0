import raw from "./voDurations3min.json";

export type VoKey3 =
  | "s1_hook"
  | "s2_checkin"
  | "s3_missed"
  | "s4_sos_meds"
  | "s5_passport"
  | "s6_vitals"
  | "s7_vault"
  | "s8_journey"
  | "s9_fall"
  | "s10_ring"
  | "s11_ambulance"
  | "s12_voice"
  | "s13_support"
  | "s14_grid"
  | "s15_outro";

export const VO3 = raw as Record<VoKey3, { text: string; seconds: number }>;

const TAIL: Record<VoKey3, number> = {
  s1_hook: 1.4,
  s2_checkin: 1.4,
  s3_missed: 1.4,
  s4_sos_meds: 1.4,
  s5_passport: 1.4,
  s6_vitals: 1.4,
  s7_vault: 1.4,
  s8_journey: 1.4,
  s9_fall: 1.4,
  s10_ring: 1.4,
  s11_ambulance: 1.4,
  s12_voice: 1.4,
  s13_support: 1.4,
  s14_grid: 1.4,
  s15_outro: 3.0,
};

const LEAD: Record<VoKey3, number> = {
  s1_hook: 0.5,
  s2_checkin: 0.3,
  s3_missed: 0.3,
  s4_sos_meds: 0.3,
  s5_passport: 0.3,
  s6_vitals: 0.3,
  s7_vault: 0.3,
  s8_journey: 0.3,
  s9_fall: 0.3,
  s10_ring: 0.3,
  s11_ambulance: 0.3,
  s12_voice: 0.3,
  s13_support: 0.3,
  s14_grid: 0.3,
  s15_outro: 0.3,
};

export const FPS3 = 30;

export const sceneFrames3 = (key: VoKey3): number => {
  const secs = LEAD[key] + VO3[key].seconds + TAIL[key];
  return Math.ceil(secs * FPS3);
};

export const voStartFrame3 = (key: VoKey3): number => Math.round(LEAD[key] * FPS3);

export const SCENE_ORDER3: VoKey3[] = [
  "s1_hook",
  "s2_checkin",
  "s3_missed",
  "s4_sos_meds",
  "s5_passport",
  "s6_vitals",
  "s7_vault",
  "s8_journey",
  "s9_fall",
  "s10_ring",
  "s11_ambulance",
  "s12_voice",
  "s13_support",
  "s14_grid",
  "s15_outro",
];

export const TOTAL_FRAMES3 = SCENE_ORDER3.reduce((acc, k) => acc + sceneFrames3(k), 0);
