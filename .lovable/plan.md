# Brand the Check-iN video

Add the real product logo, tighten colors to the Check-iN palette, and bookend the 3‑minute video with a proper title card and end card.

## What changes

1. **Logo asset**
   - Copy `public/pwa-512x512.png` into `remotion/public/brand/logo.png` (Remotion serves `public/` via `staticFile`).
   - Also copy `public/Final_Check-iN_Letterhead.png` to `remotion/public/brand/letterhead.png` for the end card.

2. **Brand palette (theme.ts)**
   - Align `COLORS` with `branding/tokens.css`:
     - `navy` #1C3D5A (currently #1a365d)
     - `emerald` #2EC04A (currently #10b981)
     - `sos` #EF4444, `amber` #F5A302
   - Keep names stable so no scene needs refactoring; only hex values shift.

3. **Title card (new scene `s0_title`, ~4s)**
   - Full-bleed navy gradient background (`--primary` navy → deeper navy).
   - Centered real logo (from `staticFile('brand/logo.png')`), springs in with subtle glow.
   - Wordmark "Check-iN" in Plus Jakarta 800, white.
   - Subtitle "Medication Reminder & Senior Safety App for India" in Inter 500.
   - Small "by Future Wave · futurewave.in" footer chip.
   - Inserted at the start of `SCENE_ORDER3` in `voDurations3min.ts`; no voiceover (silent brand beat) so existing VO timing stays intact.

4. **Hook scene (`s1_hook`) refresh**
   - Replace the inline SVG heart with the real logo PNG inside the emerald ring for consistency.

5. **End card (replace/extend `s15_outro`)**
   - Navy background, centered logo, wordmark, tagline "Because caring should be simple."
   - CTA pill in emerald: "iamgood.lovable.app · Free to start".
   - Footer line: "Future Wave · futurewave.in" with small letterhead mark.
   - Keep current duration and VO.

6. **Re-render**
   - Rebuild `demo-3min-landscape` to `/mnt/documents/checkin-3min.mp4` (~3m04s after adding the 4s title card).

## Technical notes

- Files touched:
  - `remotion/src/theme.ts` (color hex values only)
  - `remotion/src/scenes/Hook.tsx` (swap SVG for `<Img src={staticFile('brand/logo.png')} />`)
  - `remotion/src/scenes/Outro.tsx` (logo + branding polish)
  - `remotion/src/scenes/TitleCard.tsx` (new)
  - `remotion/src/MainVideo3min.tsx` (register `s0_title` → `TitleCard`)
  - `remotion/src/voDurations3min.ts` / `.json` (prepend `s0_title` with ~120 frames, no VO entry)
  - `remotion/public/brand/logo.png`, `remotion/public/brand/letterhead.png` (new assets)
- No app/runtime code changes; strictly `remotion/` project.
- No new VO clips needed — title card is silent, end card reuses existing `s15_outro.mp3`.
