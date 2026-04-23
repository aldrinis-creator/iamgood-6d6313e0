

## Plan — Open camera directly when entering Nutrition

When the user taps **My Health → Wellness Hub → Nutrition**, skip both the four-action picker and the upload/manual-entry screen, and trigger the device **camera capture** immediately.

### Change — `src/components/NutritionAdvisor.tsx`

- On mount, auto-select the `analyze_meal` action and programmatically click a hidden `<input type="file" accept="image/*" capture="environment">` so the native camera opens straight away.
- After the user takes the photo, the existing analyze flow runs (preview → "Analyze" → AI result). If the user cancels the camera, they land on the existing Analyze screen with the upload / manual-entry options still available, so no path is lost.
- The auto-launch fires only once per mount (guarded by a ref) so it doesn't re-trigger after the user cancels or returns from the result view.
- The in-form back arrow continues to return to the four-action picker, keeping Meal Plan / Post-Workout / Feeling Unwell reachable in one extra tap.

### What I will NOT change

- No change to `MyHealth.tsx` routing or the Wellness Hub tile list.
- No change to the nutrition AI edge function, persona logic, or `meal_logs` insert.
- No change to `CalorieTracker` or the "Nutrition Metrics" entry point.
- No new tile, route, or deep-link parameter.

### Verification

1. Tap **My Health → Wellness Hub → Nutrition** on a mobile device → native camera opens immediately.
2. Take a photo → returns to the Analyze screen with preview ready → tap **Analyze** to run AI.
3. Cancel the camera → lands on the Analyze screen with upload / manual-entry still available.
4. Tap the in-form back arrow → returns to the four-action picker.

