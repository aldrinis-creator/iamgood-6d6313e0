

## Plan — Full-screen camera-only mode for Nutrition

When the user enters **My Health → Wellness Hub → Nutrition**, render a dedicated full-screen camera capture view that blocks all other actions (no manual entry, no upload, no action picker) until they either successfully capture a photo or explicitly cancel.

### Change — `src/components/NutritionAdvisor.tsx`

**1. New `cameraOnly` gate state**
- Add `const [cameraOnly, setCameraOnly] = useState(true)` so the component mounts in camera-only mode.
- Keep the existing `autoLaunchedRef` guard so the native camera fires exactly once on mount.

**2. New full-screen camera UI (rendered first, before all other branches)**

While `cameraOnly === true` and no preview exists yet, render a fixed full-screen overlay containing:
- App header strip with title **"Capture Meal"** and a single **Cancel** button (top-right).
- Centered guidance: camera icon + "Opening camera…" / "Take a clear photo of your meal".
- A primary **Open Camera** button (re-trigger) — needed because the auto-launch can be dismissed by the OS or fail silently; this is the only visible action besides Cancel.
- A small **Retry** affordance shown only after a failed/empty capture (toast + button), since this mode hides the existing Camera/Upload buttons that previously served as the implicit retry.
- No tabs, no manual entry, no upload, no action picker, no back-to-hub link inside this overlay.

**3. Capture outcomes**
- **Success** (`handleFile` receives a valid image): set `cameraOnly = false`, show the existing preview + **Analyze** screen so the user can confirm and run AI. From here the normal flow continues unchanged.
- **Cancel** (user taps the overlay's Cancel): set `cameraOnly = false` and clear `activeAction`, returning to the four-action picker (Meal Plan / Analyze / Post-Workout / Feeling Unwell). This is the only escape hatch.
- **Failed/empty capture** (file input fires with no file, or `toast.error` path for invalid type / >10MB): keep `cameraOnly = true`, surface a Retry button that re-clicks the hidden `<input capture="environment">`.

**4. Outer navigation**
- The outer `MyHealth.tsx` "← Nutrition" back chevron continues to work — it unmounts `NutritionAdvisor` and returns to the Wellness Hub. No change there.

### What I will NOT change

- No change to `MyHealth.tsx`, routing, hub tiles, or feature gating.
- No change to the nutrition AI edge function, persona logic, or `meal_logs` insert.
- No change to `CalorieTracker` / Nutrition Metrics — still reachable from inside the post-capture analyze view, not from the camera-only overlay.
- No new route, deep-link param, or DB column.

### Verification

1. Tap **My Health → Wellness Hub → Nutrition** on mobile → full-screen "Capture Meal" overlay appears and the native camera opens immediately. No tabs, manual entry, upload, or other actions are visible.
2. Take a photo → overlay dismisses, preview shows with **Analyze** button. Normal AI flow proceeds.
3. Cancel the OS camera dialog → still on the overlay; tap **Open Camera** to retry, or **Cancel** to exit to the four-action picker.
4. Pick an oversized/non-image file (edge case via file picker on desktop) → toast error, overlay stays, Retry button visible.
5. Tap the outer "← Nutrition" chevron → returns to Wellness Hub as before.

