// Generate ElevenLabs Sarah VO clips for the 3-minute demo.
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/audio/3min");
const SRC_DIR = path.resolve(__dirname, "../src");
await fs.mkdir(OUT_DIR, { recursive: true });

const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah — same as 60s demo
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) throw new Error("ELEVENLABS_API_KEY missing");

const SCRIPT = [
  { id: "s1_hook",       text: "Meet Check-iN. Peace of mind for families caring for aging parents — in just three taps a day." },
  { id: "s2_checkin",    text: "At seven A M, noon, and seven P M — tap the heart. Your family instantly knows you're safe." },
  { id: "s3_missed",     text: "Miss a check-in, and every guardian gets a loud alert — even if their phone is on silent." },
  { id: "s4_sos_meds",   text: "Never miss a medication. And in an emergency, one tap on SOS alerts everyone who cares." },
  { id: "s5_passport",   text: "Your Health Passport rolls vitals, sleep, mood and meals into one daily score out of a hundred." },
  { id: "s6_vitals",     text: "No wearable needed. Capture heart rate, oxygen and blood pressure with a thirty-second face scan." },
  { id: "s7_vault",      text: "The Medical Vault keeps every prescription, lab report and ID document encrypted, and ready for your nominee." },
  { id: "s8_journey",    text: "Draw safe zones on the map. If your loved one wanders more than a kilometre, guardians hear about it on WhatsApp." },
  { id: "s9_fall",       text: "Fall detection watches in the background. A fifteen-second window to cancel — or SOS fires automatically." },
  { id: "s10_ring",      text: "Guardians see the full picture — vitals, mood and medication adherence — in one calm dashboard." },
  { id: "s11_ambulance", text: "In a real emergency, one tap dispatches an ambulance, with your medical emergency card pre-sent to the driver." },
  { id: "s12_voice",     text: "Prefer to just ask? Our Indian-accent voice assistant answers questions about your meds, appointments and the app itself." },
  { id: "s13_support",   text: "Need a human? Chat with our team on WhatsApp — or plug Check-iN into Claude and ChatGPT with our MCP integration." },
  { id: "s14_grid",      text: "Plus first aid, blood banks, wellness tracking, doctor visit reports, and much more — all in one app." },
  { id: "s15_outro",     text: "Check-iN. Because caring should be simple." },
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

await fs.writeFile(path.join(SRC_DIR, "voDurations3min.json"), JSON.stringify(durations, null, 2));
console.log("Wrote voDurations3min.json");
