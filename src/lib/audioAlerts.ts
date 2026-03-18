let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  return audioContext;
};

export const playChime = async () => {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  const now = ctx.currentTime;

  // First note — C5 (523 Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.value = 523;
  gain1.gain.setValueAtTime(0.4, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.4);

  // Second note — E5 (659 Hz)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.value = 659;
  gain2.gain.setValueAtTime(0.4, now + 0.25);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + 0.25);
  osc2.stop(now + 0.7);

  // Third note — G5 (784 Hz)
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = "sine";
  osc3.frequency.value = 784;
  gain3.gain.setValueAtTime(0.35, now + 0.5);
  gain3.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
  osc3.connect(gain3).connect(ctx.destination);
  osc3.start(now + 0.5);
  osc3.stop(now + 1.0);
};

export const playVoiceReminder = (message = "It's time for your Check-iN") => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
};

export type AudioAlertMode = "off" | "chime" | "voice";

const STORAGE_KEY = "checkin-audio-mode";

export const getAudioMode = (): AudioAlertMode => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "chime" || stored === "voice") return stored;
  return "off";
};

export const setAudioMode = (mode: AudioAlertMode) => {
  localStorage.setItem(STORAGE_KEY, mode);
};

export const testAlert = (mode: AudioAlertMode) => {
  if (mode === "chime") {
    playChime();
  } else if (mode === "voice") {
    playVoiceReminder("This is a test. It's time for your Check-iN.");
  }
};
