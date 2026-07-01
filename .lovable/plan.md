# 60-Second Check-iN Demo Video

A code-generated MP4 demo built with Remotion. Rendered in two aspect ratios (1920×1080 landscape + 1080×1920 vertical) from the same scene library. Uses real Check-iN brand colors, animated phone mockups with authentic app screenshots, and ElevenLabs "Sarah" voiceover with burned-in captions.

Final output: `/mnt/documents/checkin-demo-landscape.mp4` and `/mnt/documents/checkin-demo-vertical.mp4`.

## Storyboard (60s @ 30fps = 1800 frames)

| Time | Scene | Visual | Voiceover |
|------|-------|--------|-----------|
| 0–6s | **Hook** | Animated Check-iN heart logo pulse, tagline fades in | "Meet Check-iN — peace of mind for families, in just three taps a day." |
| 6–14s | **User: Check-iN** | Phone mockup, big heart, tap animation, "Checked In ✓" | "At 7 AM, noon, and 7 PM, tap the heart. Your family instantly knows you're safe." |
| 14–22s | **User: Meds + SOS** | Split — medication reminder + red SOS button pressed | "Never miss a medication. And in an emergency, one tap alerts everyone who cares." |
| 22–32s | **Guardian: Ward ring** | Guardian dashboard, ward health score ring animates 0→92 | "Guardians see the full picture — vitals, mood, adherence — at a glance." |
| 32–40s | **Guardian: Missed alert** | Red missed-check-in overlay + WhatsApp Safe Zone alert card | "If a check-in is missed, or your loved one leaves their safe zone, we alert you instantly on WhatsApp." |
| 40–48s | **Safety net** | Fall detection overlay, Map My Journey trail, Vault icon | "Fall detection, journey tracking, and a secure health vault — all working quietly in the background." |
| 48–55s | **Feature grid** | 8 tile grid pulse (Meds, Vitals, First Aid, etc.) | "Plus medications, vitals, first aid, blood banks, and a voice assistant that's always listening." |
| 55–60s | **Outro** | Logo, "iamgood.lovable.app", "Free to start" | "Check-iN. Because caring should be simple." |

## Visual Direction

- **Palette:** Navy #1a365d (primary), Emerald #10b981 (Check-iN accent), SOS Red #ef4444, Cream #fefaf3 background, Charcoal #1f2937 text
- **Fonts:** `Plus Jakarta Sans` (display, bold) + `Inter` (body) via `@remotion/google-fonts`
- **Motion system:** Default entrance = spring `{damping: 18, stiffness: 180}` with 4-frame stagger. Scene transitions = `slide` for User→Guardian handoff, `fade` elsewhere. Persistent soft radial gradient background drifts across all scenes.
- **Phone mockup:** Rounded 48px frame, 9:19.5 aspect, subtle shadow. Real screenshots captured via Playwright from the running preview go inside the frame.

## Technical Plan

1. **Scaffold** `remotion/` project with bun; install `remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/transitions`, `@remotion/google-fonts`, `@remotion/compositor-linux-x64-musl`. Fix NixOS compositor binary + symlink ffmpeg/ffprobe.
2. **Capture screenshots** via Playwright against `http://localhost:8080` (login as test user if `LOVABLE_BROWSER_AUTH_STATUS=injected`): User dashboard, Check-iN card, Medication tab, SOS dialog, Guardian dashboard, Ward ring, Missed alert overlay. Save to `remotion/public/screens/`. If auth is unavailable, fall back to illustrated mockups.
3. **Generate voiceover** — one `voiceover.mp3` per script segment via ElevenLabs Sarah (`EXAVITQu4vr4xnSDxMaL`, multilingual_v2). Run a one-off Node script using `ELEVENLABS_API_KEY` (already synced via the standard connector) → save to `remotion/public/audio/`. Get durations with `@remotion/media-utils` and pin scene lengths to VO.
4. **Compositions** — register TWO compositions in `Root.tsx`:
   - `demo-landscape` 1920×1080
   - `demo-vertical` 1080×1920
   Both consume the same 8 scene components with responsive layout props.
5. **Scenes** — one file each under `src/scenes/`: `Hook`, `UserCheckIn`, `UserMedsSos`, `GuardianRing`, `GuardianAlerts`, `SafetyNet`, `FeatureGrid`, `Outro`. Wired via `<TransitionSeries>`.
6. **Captions** — burned-in bottom band, word-by-word highlight driven by frame → VO timing map.
7. **Render** via programmatic script (`scripts/render-remotion.mjs`) using `chromeMode: "chrome-for-testing"`, `concurrency: 1`, non-muted (VO must be audible), h264. Run twice: once per composition. Copy MP4s to `/mnt/documents/`.
8. **QA** — extract a still at t=3s, 15s, 30s, 45s, 55s per render via `bunx remotion still`; visually inspect frames for layout/text issues before delivering.

## Deliverables

- `/mnt/documents/checkin-demo-landscape.mp4` (~15–20 MB)
- `/mnt/documents/checkin-demo-vertical.mp4` (~15–20 MB)
- `remotion/` folder committed to the project so the demo can be re-rendered / edited later
- `<presentation-artifact>` tags for both MP4s in the final reply

## Risks & Fallbacks

- **Screenshot capture fails** (auth unavailable) → fall back to hand-crafted SVG mockups inside the phone frame; video still ships.
- **ElevenLabs credit exhausted** → fall back to on-screen captions only; render is silent but complete.
- **Render exceeds 10 min sandbox cap** → drop vertical from first pass; deliver landscape, then render vertical in a follow-up turn.
- **Bundle install issues on NixOS** → the musl compositor swap + ffmpeg symlink (per skill instructions) is applied up-front.

Estimated render time: ~4–6 min per composition. Total build time: ~15–20 min.