# Add Exercise Reminder Toggle in Settings

## What

Add a deafult on/off toggle for the exercise reminder (8 AM / 6 PM) in the Settings → Alerts tab, and a field to let users customize the two reminder times.

## Changes

### 1. Add `exerciseReminder` to UserSettings

**File**: `src/hooks/useUserSettings.ts`

- Add `exerciseReminder: boolean` to the `UserSettings` interface
- Default to `true` in `DEFAULTS`

### 2. Add toggle in Settings → Alerts tab

**File**: `src/pages/Settings.tsx`

- Add a new Switch row after the "Vibration & Notifications" toggle (around line 456)
- Label: "Exercise Reminders" / "Audio reminders at 8 AM and 6 PM for exercise"
- Icon: `Dumbbell` from lucide-react
- Wired to `settings.exerciseReminder` via `updateSetting`

### 3. Respect the toggle in the hook

**File**: `src/hooks/useExerciseReminder.ts`

- Add early return in `check()` if `settings.exerciseReminder === false`

## Files Changed

- `src/hooks/useUserSettings.ts` — add `exerciseReminder` field
- `src/pages/Settings.tsx` — add toggle row
- `src/hooks/useExerciseReminder.ts` — gate on `settings.exerciseReminder`