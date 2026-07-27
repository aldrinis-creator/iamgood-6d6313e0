## Plan

1. **Finish the branded 3-minute landscape render**
   - Check background process (PID 6863) status; if still running, wait for it. If it stalled or failed, re-run `node scripts/render-remotion.mjs demo-3min-landscape /mnt/documents/checkin-3min.mp4`.

2. **Add a 9:16 vertical composition**
   - In `remotion/src/Root.tsx`, register a new `demo-3min-vertical` composition:
     - `component={MainVideo3min}`
     - `width={1080}`, `height={1920}`
     - `fps={FPS3}`, `durationInFrames={TOTAL_FRAMES3 + TITLE_CARD_FRAMES}`
     - `defaultProps={{ orientation: "vertical" }}`
   - No scene code changes required — all 3-min scenes (`TitleCard`, `Hook`, `Outro`, and the 13 feature scenes) already branch on the `orientation` prop and have vertical layouts.

3. **Render the vertical MP4**
   - Run `cd remotion && node scripts/render-remotion.mjs demo-3min-vertical /mnt/documents/checkin-3min-vertical.mp4`.
   - Expected: 1080x1920, ~3m 04s, audio + captions preserved.

4. **Report both files** with paths and sizes.

No changes to scene components, VO, timing, theme, or audio — vertical layouts are already implemented via the `orientation` prop path.
