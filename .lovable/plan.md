## 3-Minute Check-iN Feature Tour Video

Extend the existing Remotion project (`remotion/`) to produce a ~180-second landscape (1920x1080) feature-tour video with ElevenLabs voiceover matching the current 60s demo.

### Structure (~15 feature beats, ~11s each)

1. **Hook** — "Peace of mind for families, in three taps a day."
2. **Daily Check-iN** — 7AM/12PM/7PM tap-the-heart flow
3. **Missed check-in escalation** — guardian gets loud alarm
4. **SOS button** — one tap alerts everyone, WhatsApp + location
5. **Medications** — reminders, voice alerts, refill nudges
6. **Health Passport** — daily score out of 100, trends
7. **Vitals & face scan** — BP, HR, SpO₂ via camera
8. **Medical Vault** — secure documents, nominee access
9. **Map My Journey** — safe zones, geofencing, deviation alerts
10. **Fall detection** — auto-SOS on impact
11. **Guardian Dashboard** — vitals, mood, adherence at a glance
12. **Ambulance booking** — one-tap dispatch with emergency card
13. **AI Voice Assistant + Ask Check-iN** — Indian-accent help bot
14. **Customer Services & MCP** — WhatsApp support, Claude/ChatGPT integration
15. **Outro** — "Check-iN. Because caring should be simple."

### Technical details

- New file `remotion/src/voDurations3min.ts` with the 15-scene script + timings.
- Reuse `Hook`, `UserCheckIn`, `UserMedsSos`, `GuardianRing`, `GuardianAlerts`, `SafetyNet`, `FeatureGrid`, `Outro`. Add 7 new scene components under `remotion/src/scenes/` (HealthPassport, Vitals, Vault, Journey, FallDetection, Ambulance, VoiceAssistant, CustomerService) reusing `PhoneFrame` + existing `theme.ts` tokens.
- New `MainVideo3min.tsx` wiring scenes via `Series` with the same caption + audio pattern.
- Register a new composition id `demo-3min-landscape` (1920x1080, 30fps) in `Root.tsx`.
- Regenerate VO MP3s via existing `remotion/scripts/generate-vo.mjs` (ElevenLabs, same voice as 60s demo) into `remotion/public/audio/3min/`.
- Render via existing `render-remotion.mjs demo-3min-landscape /mnt/documents/checkin-3min.mp4`.
- Keep total under 190s to stay within the 600s render timeout at concurrency 2.

### Deliverable

`/mnt/documents/checkin-3min.mp4` (landscape, ~180s, with narration + captions), served via `<presentation-artifact>`.

### Out of scope

- Vertical (9:16) render.
- Voice change to Sarvam.
- New in-app UI changes.
