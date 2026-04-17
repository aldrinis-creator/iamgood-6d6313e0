let audioContext: AudioContext | null = null;
let preCachedAudio: HTMLAudioElement | null = null;
let speechPrimed = false;

const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  return audioContext;
};

// --- Re-unlock on EVERY user gesture (no single-fire guard) ---
const unlockAudio = async () => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    // Play silent buffer to fully unlock
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore
  }

  // Pre-cache an Audio element on gesture so it can be reused programmatically
  if (!preCachedAudio) {
    try {
      preCachedAudio = new Audio(SILENT_WAV);
      preCachedAudio.volume = 0;
      await preCachedAudio.play().catch(() => {});
    } catch {
      // ignore
    }
  }

  // Prime speechSynthesis with a silent utterance
  if (!speechPrimed && "speechSynthesis" in window) {
    try {
      const silent = new SpeechSynthesisUtterance("");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
      speechPrimed = true;
    } catch {
      // ignore
    }
  }
};

if (typeof document !== "undefined") {
  const handler = () => { unlockAudio(); };
  document.addEventListener("click", handler, { passive: true });
  document.addEventListener("touchstart", handler, { passive: true });
}

// --- Exported: re-resume context right before playing ---
export const ensureAudioReady = async (): Promise<boolean> => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
};

// --- Fallback: HTML5 Audio from generated WAV blob ---
const playFallbackBeep = () => {
  // Try pre-cached element first
  if (preCachedAudio) {
    try {
      preCachedAudio.src = "";
      const sampleRate = 8000;
      const duration = 0.3;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);
      const writeStr = (offset: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
      };
      writeStr(0, "RIFF");
      view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, "WAVE");
      writeStr(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, "data");
      view.setUint32(40, numSamples * 2, true);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * 660 * t) * 0.4;
        view.setInt16(44 + i * 2, sample * 32767, true);
      }
      const blob = new Blob([buffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      preCachedAudio.src = url;
      preCachedAudio.volume = 0.5;
      preCachedAudio.play().catch(() => {});
      preCachedAudio.onended = () => URL.revokeObjectURL(url);
      return;
    } catch {
      // fall through
    }
  }

  // Last resort: new Audio element
  try {
    const sampleRate = 8000;
    const duration = 0.3;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, numSamples * 2, true);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * 660 * t) * 0.4;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }
    const blob = new Blob([buffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audio.onended = () => URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
};

export const playChime = async () => {
  await ensureAudioReady();
  const ctx = getAudioContext();

  // If still suspended, use fallback
  if (ctx.state !== "running") {
    playFallbackBeep();
    return;
  }

  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.value = 523;
  gain1.gain.setValueAtTime(0.4, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.4);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.value = 659;
  gain2.gain.setValueAtTime(0.4, now + 0.25);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + 0.25);
  osc2.stop(now + 0.7);

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

export const speak = async (message: string): Promise<void> => {
  await ensureAudioReady();
  if (!("speechSynthesis" in window)) return;
  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel();
      const silent = new SpeechSynthesisUtterance("");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);

      const u = new SpeechSynthesisUtterance(message);
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = 1.0;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
};

export const stopSpeaking = () => {
  try {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
};

export const playVoiceReminder = async (message = "It's time for your Check-iN") => {
  await ensureAudioReady();
  if (!("speechSynthesis" in window)) {
    playChime();
    return;
  }
  window.speechSynthesis.cancel();

  // Re-prime with silent utterance before real message
  const silent = new SpeechSynthesisUtterance("");
  silent.volume = 0;
  window.speechSynthesis.speak(silent);

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
};

export const showBrowserNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") new Notification(title, { body, icon: "/favicon.ico" });
    });
  }
};
