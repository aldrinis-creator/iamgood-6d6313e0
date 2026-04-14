

## Suppress Notifications/Alerts During Login

### Problem
During login, various notifications, alerts, and overlays fire prematurely — notification permission prompts, welcome email triggers, reminder overlays, battery warnings, etc. — before the user has fully landed on their dashboard.

### Solution
Add a `loginInProgress` flag to `AuthContext` that is `true` from the moment sign-in starts until the profile is fully loaded and the auth state change handler completes. All alert-producing systems check this flag and stay silent while it's active.

### Changes

**1. `src/contexts/AuthContext.tsx`** — Add and expose `loginInProgress` state
- Set `loginInProgress = true` at the start of `signIn()` and during `onAuthStateChange` when a new session appears
- Set `loginInProgress = false` after profile fetch completes (inside the `setTimeout` callback, after `fetchProfile`)
- Move the `Notification.requestPermission()` call inside the setTimeout, after profile is loaded
- Export `loginInProgress` in the context value

**2. `src/contexts/AppContext.tsx`** — Pass through `loginInProgress` from AuthContext
- Expose it in `AppState` so hooks/components can access it via `useApp()`

**3. `src/components/AppLayout.tsx`** — Guard overlays with `loginInProgress`
- Don't render `BatteryWarning`, `FallDetectionOverlay`, `GuardianPingOverlay`, `ReminderOverlay`, `CookieConsent`, `EmergencyModeOverlay`, or `UserOnlyHooks` while `loginInProgress` is `true`

**4. Alert hooks** — Early-return when login is in progress
- `useCheckInAudio.ts` — check `loginInProgress` before firing
- `useMedicationAlarms.ts` — check `loginInProgress` before firing  
- `useExerciseReminder.ts` — check `loginInProgress` before firing
- `useAppointmentAlarms.ts` — check `loginInProgress` before firing
- `useAutoSleepMode.ts` — check `loginInProgress` before firing

### Files to modify
- `src/contexts/AuthContext.tsx`
- `src/contexts/AppContext.tsx`
- `src/components/AppLayout.tsx`
- `src/hooks/useCheckInAudio.ts`
- `src/hooks/useMedicationAlarms.ts`
- `src/hooks/useExerciseReminder.ts`
- `src/hooks/useAppointmentAlarms.ts`
- `src/hooks/useAutoSleepMode.ts`

