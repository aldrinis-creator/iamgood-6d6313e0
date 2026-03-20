// Ambient sound generators for mindfulness exercises using Web Audio API

let audioCtx: AudioContext | null = null;
let activeNodes: AudioNode[] = [];
let activeOscillators: OscillatorNode[] = [];
let isPlaying = false;

const getCtx = (): AudioContext => {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  return audioCtx;
};

const cleanup = () => {
  activeOscillators.forEach(o => { try { o.stop(); } catch {} });
  activeNodes.forEach(n => { try { n.disconnect(); } catch {} });
  activeOscillators = [];
  activeNodes = [];
  isPlaying = false;
};

/** Deep Breathing — slow ocean-like filtered noise */
const playBreathingAmbient = (ctx: AudioContext) => {
  // White noise via buffer
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  // Bandpass for ocean feel
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 400;
  filter.Q.value = 0.5;

  // Breathing rhythm LFO on gain
  const gain = ctx.createGain();
  gain.gain.value = 0.08;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1; // ~6 breaths/min
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.06;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  lfo.start();

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start();

  activeNodes.push(noise, filter, gain, lfo, lfoGain);
  activeOscillators.push(lfo);
  // BufferSource doesn't have stop in the same way, handle in cleanup
  (noise as any)._isBufferSource = true;
  activeOscillators.push(noise as any);
};

/** Body Scan — warm drone with gentle harmonics */
const playBodyScanAmbient = (ctx: AudioContext) => {
  const freqs = [110, 165, 220]; // A2, E3, A3
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = i === 0 ? 0.06 : 0.03;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    activeOscillators.push(osc);
    activeNodes.push(gain);
  });
};

/** Sound Meditation — gentle chime pattern */
const playSoundMeditationAmbient = (ctx: AudioContext) => {
  const chimeNotes = [523, 659, 784, 880, 1047]; // C5 E5 G5 A5 C6
  let chimeIndex = 0;

  const playOneChime = () => {
    if (!isPlaying) return;
    const freq = chimeNotes[chimeIndex % chimeNotes.length];
    chimeIndex++;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 3);

    // Schedule next chime randomly 3-6s later
    const next = 3000 + Math.random() * 3000;
    setTimeout(playOneChime, next);
  };

  playOneChime();
};

/** Visualization — soft pad with slow filter sweep */
const playVisualizationAmbient = (ctx: AudioContext) => {
  // Soft pad chord: C4 E4 G4
  const freqs = [262, 330, 392];
  freqs.forEach(freq => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;

    // Slow sweep on filter
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = ctx.createGain();
    gain.gain.value = 0.04;

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();

    activeOscillators.push(osc, lfo);
    activeNodes.push(filter, gain, lfoGain);
  });
};

const generators: Record<number, (ctx: AudioContext) => void> = {
  0: playBreathingAmbient,
  1: playBodyScanAmbient,
  2: playSoundMeditationAmbient,
  3: playVisualizationAmbient,
};

export const startMindfulnessAudio = async (exerciseIndex: number) => {
  cleanup();
  const ctx = getCtx();
  if (ctx.state === "suspended") await ctx.resume();
  isPlaying = true;
  const gen = generators[exerciseIndex];
  if (gen) gen(ctx);
};

export const stopMindfulnessAudio = () => {
  isPlaying = false;
  cleanup();
};
