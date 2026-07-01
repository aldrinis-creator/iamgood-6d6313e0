// Generate ElevenLabs Sarah VO clips for each scene, then measure durations.
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/audio");
const SRC_DIR = path.resolve(__dirname, "../src");
await fs.mkdir(OUT_DIR, { recursive: true });

const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) throw new Error("ELEVENLABS_API_KEY missing");

const SCRIPT = [
  { id: "s1_hook",      text: "Meet Check-iN. Peace of mind for families, in just three taps a day." },
  { id: "s2_checkin",   text: "At seven A M, noon, and seven P M — tap the heart. Your family instantly knows you're safe." },
  { id: "s3_meds_sos",  text: "Never miss a medication. And in an emergency, one tap alerts everyone who cares." },
  { id: "s4_ring",      text: "Guardians see the full picture — vitals, mood, adherence — at a glance." },
  { id: "s5_alerts",    text: "If a check-in is missed, or your loved one leaves their safe zone, we alert you instantly on WhatsApp." },
  { id: "s6_safety",    text: "Fall detection, journey tracking, and a secure health vault — all working quietly in the background." },
  { id: "s7_grid",      text: "Plus medications, vitals, first aid, blood banks, and a voice assistant that's always listening." },
  { id: "s8_outro",     text: "Check-iN. Because caring should be simple." },
];

const durations = {};

for (const seg of SCRIPT) {
  const outPath = path.join(OUT_DIR, `${seg.id}.mp3`);
  console.log(`→ ${seg.id}`);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: seg.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 1.0 },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS ${seg.id}: ${res.status} ${err}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
  const dur = parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${outPath}"`).toString().trim(),
  );
  durations[seg.id] = { text: seg.text, seconds: dur };
  console.log(`   ${dur.toFixed(2)}s`);
}

const totalVo = Object.values(durations).reduce((a, b) => a + b.seconds, 0);
console.log(`Total VO: ${totalVo.toFixed(2)}s`);

await fs.writeFile(path.join(SRC_DIR, "voDurations.json"), JSON.stringify(durations, null, 2));
console.log("Wrote voDurations.json");
