// Loud, looping phone-style ringer built on Web Audio.
// Two-tone classic ring (440/480 Hz) for 2s, 1s silence, repeat.
// Falls back gracefully if AudioContext can't run.

import { ensureAudioReady } from "./audioAlerts";

let ctx: AudioContext | null = null;
let ringTimer: number | null = null;
let activeNodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
let ringing = false;

const getCtx = () => {
  if (!ctx || ctx.state === "closed") {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return ctx;
};

const stopActive = () => {
  for (const { osc, gain } of activeNodes) {
    try { osc.stop(); } catch {}
    try { osc.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  }
  activeNodes = [];
};

const playRingBurst = () => {
  const c = getCtx();
  if (c.state !== "running") return;
  stopActive();
  const now = c.currentTime;
  const duration = 2.0; // 2s ring
  const freqs = [440, 480];
  for (const f of freqs) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
    gain.gain.setValueAtTime(0.6, now + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0.0, now + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + duration);
    activeNodes.push({ osc, gain });
  }
};

export const startCallRinger = async () => {
  if (ringing) return;
  ringing = true;
  await ensureAudioReady();
  try {
    const c = getCtx();
    if (c.state === "suspended") await c.resume();
  } catch {}

  playRingBurst();
  // Repeat every 3s (2s ring + 1s pause)
  ringTimer = window.setInterval(() => {
    if (!ringing) return;
    playRingBurst();
  }, 3000);

  // Vibrate if available (mobile)
  try {
    if ("vibrate" in navigator) {
      (navigator as any).vibrate?.([800, 400, 800, 400, 800]);
    }
  } catch {}
};

export const stopCallRinger = () => {
  ringing = false;
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
  stopActive();
  try { if ("vibrate" in navigator) (navigator as any).vibrate?.(0); } catch {}
};

export const isRingerActive = () => ringing;
