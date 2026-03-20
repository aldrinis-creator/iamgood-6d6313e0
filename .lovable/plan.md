

# Connect Activity Goals to Health Passport + Confirm Fall Detection

## What's Already Done
**Fall Detection is fully built** — the hook (`useFallDetection.ts`), overlay (`FallDetectionOverlay.tsx`), settings UI (toggle + sensitivity selector in Settings), and SOS auto-trigger are all implemented and wired into `AppLayout`. No changes needed.

## What Needs to Change

### Health Passport: Use Custom Activity Goals (1 file)

**File: `src/components/HealthPassport.tsx`**

Currently the Activity score computation (lines 86-95) uses hardcoded divisors:
- `steps / 10000`, `distance_km / 5`, `calories / 500`, `active_minutes / 120`

These should use the user's custom goals from `useUserSettings` instead.

**Changes:**
1. Import `useUserSettings` and `DEFAULT_ACTIVITY_GOALS`
2. Read `settings.activityGoals` (with fallback to defaults)
3. Replace hardcoded values in the Activity score calculation:
   - `act.steps / goals.steps`
   - `act.distance_km / goals.distance_km`
   - `act.calories / goals.calories`
   - `act.active_minutes / goals.active_minutes`

This ensures the Health Passport score ring reflects the same targets the user set in the Activity Tracker's "Goals" editor.

### Ward Health Passport (optional, same pattern)

**File: `src/components/WardHealthPassport.tsx`**

Same hardcoded values exist here. Will update to use default goals (ward's custom goals aren't accessible to guardian, so defaults are appropriate).

## No Database Changes
All data already flows through the existing `user_settings.settings` JSONB column and `activity_logs` table.

