

# Add Fall Detection Sensitivity Setting

## Summary
Add a `fallSensitivity` setting (`"low"` | `"medium"` | `"high"`) to user settings, wire it into the fall detection hook to adjust thresholds, and add a selector in the Settings Check-iN tab.

## Changes

### 1. `src/hooks/useUserSettings.ts`
- Add `fallSensitivity: string` to `UserSettings` interface (after `fallDetection`)
- Add default `fallSensitivity: "medium"` to `DEFAULTS`

### 2. `src/hooks/useFallDetection.ts`
- Replace hard-coded thresholds with a sensitivity map:
  - **High**: freeFall=5, impact=22 (catches more, more false positives)
  - **Medium**: freeFall=4, impact=30 (current balanced defaults)
  - **Low**: freeFall=2.5, impact=38 (only severe falls, fewest false alarms)
- Read `settings.fallSensitivity` and select thresholds accordingly
- Add `settings.fallSensitivity` to the `useEffect` dependency array

### 3. `src/pages/Settings.tsx`
- Below the Fall Detection enable toggle (line ~510), add a `Select` dropdown:
  - Label: "Detection Sensitivity"
  - Options: Low / Medium (default) / High
  - Description text explaining each level
  - Only shown when `fallDetection` is enabled

## No database changes needed
The `fallSensitivity` value is stored inside the existing `user_settings.settings` JSONB column alongside all other settings.

