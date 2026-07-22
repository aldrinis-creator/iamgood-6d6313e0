## Goal
Ensure that at the chosen appointment alert time (first_alert / second_alert), a loud audio popup fires for **both**:
- the Ward (already implemented via `useAppointmentAlarms` + `ReminderOverlay`)
- **each accepted Guardian** of that Ward (currently missing)

Only the guardian side needs new work; the ward flow is already in place.

## Current state (verified)
- `src/hooks/useAppointmentAlarms.ts` runs in `UserOnlyHooks` (AppLayout). At T-0 of the chosen lead time it plays `playVoiceReminder` / `playLoudAlertSequence` and opens `ReminderOverlay`. At T-5 it shows a browser notification.
- `GuardianOnlyHooks` currently mounts only `useGuardianAudio` (missed check-ins). No appointment alarm hook exists for guardians.
- `appointments` rows are owned by the ward (`user_id = ward`), with `alarm_enabled`, `first_alert`, `second_alert` already set on create — guardian-added ones live on the same row, so a single ward-scoped query serves both authors.

## Changes

### 1. New hook — `src/hooks/useGuardianAppointmentAlarms.ts`
Mirrors `useAppointmentAlarms` but iterates every accepted ward:
- Load the guardian's accepted wards (reuse the same query pattern already used in `useGuardianAudio`).
- Every 30 s (and on `visibilitychange`), fetch today's `appointments` for all ward ids where `alarm_enabled = true`.
- For each appointment × each of `first_alert` / `second_alert`:
  - `T-5 min` → browser notification only (suppressed if an overlay is visible), keyed so it fires once.
  - `T-0` (within a 15-min catch-up window, once per slot key) →
    - `playVoiceReminder` (if `settings.voiceReminders`) else `playLoudAlertSequence` (if `settings.audioAlerts`).
    - Vibrate if `settings.vibration`.
    - Call `showReminderOverlay({ type: "appointment", title: "Ward Appointment", message: "[HH:MM IST] <WardName>: <Title> starts in <lead> minutes", reminderCount: appt.start_time, slotKey })`.
  - Slot key includes ward id + appointment id + alert key + date so multiple wards don't collide and it never re-fires.
- Respects `pauseMode !== "active"` and `loginInProgress` guards, same as the ward hook.
- Gated by a new setting toggle (see below); default ON.

### 2. Wire into layout
`src/components/AppLayout.tsx` — add `useGuardianAppointmentAlarms()` inside the existing `GuardianOnlyHooks` component. No other layout changes.

### 3. Settings toggle
`src/hooks/useUserSettings.ts` — add `guardianAppointmentAlarms: boolean` (default `true`) to the settings shape and defaults.
`src/pages/GuardianSettings.tsx` — add a Switch row "Appointment audio alerts" in the notifications/alerts section, wired to the new setting.

### 4. No changes to the ward side
`useAppointmentAlarms` already delivers the audio popup at the selected alert time — confirmed by reading the hook. Ward behaviour stays as-is.

## Technical notes
- Reuses existing `ReminderOverlay` (already mounted globally in `AppLayout`) and existing audio helpers in `src/lib/audioAlerts.ts` — no new UI component needed.
- Message prefixed with ward name so a guardian with multiple wards immediately knows whose appointment it is.
- Ward-scoped query + `todayStr` filter keeps read volume low.
- No DB changes, no edge function changes, no migrations.

## Out of scope
- Push notifications when the guardian's app is fully closed (would need a server cron similar to `send-checkin-push`). Can be a follow-up if you want off-device delivery.
