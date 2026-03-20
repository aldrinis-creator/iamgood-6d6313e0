

# Customizable Daily Goals for Activity Tracker

## Approach
Store user-customizable goals in the existing `user_settings` table (inside the `settings` JSONB column), alongside other user preferences. No database migration needed.

## Changes

### 1. `src/hooks/useUserSettings.ts`
- Add `activityGoals` to `UserSettings` interface with keys matching each metric (steps, heart_rate, calories, etc.)
- Set defaults matching current hardcoded values (steps: 10000, calories: 500, etc.)

### 2. `src/components/ActivityTracker.tsx`
- Import and use `useUserSettings` to get user goals
- Replace hardcoded `goal` values in `METRICS` with dynamic values from settings
- Add a "Set Goals" button (Target icon) next to "Log Today"
- Add a goals editing dialog/card with number inputs for each metric's daily target
- On save, call `updateSetting("activityGoals", newGoals)` to persist

### UI Details
- Goals editor shown as a collapsible card (similar to the log form toggle)
- Each metric gets a labeled number input with its current goal pre-filled
- Save button persists to `user_settings` via the existing debounced hook
- Summary cards and radial progress rings immediately reflect custom goals

