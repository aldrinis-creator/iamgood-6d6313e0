Remove the "Quick Visual Checks" tile from My Health, and rename "Wellness" to "Mindfulness" within the Wellness Hub.

**Changes**

1. **Remove "Quick Visual Checks" tile**
   - File: `src/pages/MyHealth.tsx`
   - Remove the `{ icon: Eye, label: "Quick Visual Checks", ... }` entry from the `healthTools` array (grid becomes 7 tiles, 3-col grid keeps layout).
   - Remove `"Quick Visual Checks"` from `HUB_TOOLS` array.
   - Remove the `visualChecksSubItems` array and the `"Quick Visual Checks"` entry in `hubConfig`.
   - Remove unused `Eye` import.
   - Keep legacy redirect entries for `Face Scan`, `Urine Check`, `Tongue Check` pointing to `Quick Visual Checks` intact (they still route into the hub; the hub itself is just no longer exposed as a top-level tile).

2. **Rename "Wellness" to "Mindfulness" in Wellness Hub**
   - File: `src/pages/MyHealth.tsx`
   - In `wellnessHubSubItems`, change label from `"Wellness"` to `"Mindfulness"`.
   - In `subToolComponents`, change key from `"Wellness"` to `"Mindfulness"` (still maps to `WellnessTracker` component).
   - Keep the legacy redirect key `"Wellness": "Wellness Hub"` unchanged (URL param mapping, not user-facing label).

No backend, database, or new dependencies required.