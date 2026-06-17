## Persistent Guardian Audio Alarm for Missed Check-iNs

Today guardians get a single voice line via `GuardianDashboard.fetchMissedEvents` when a ward's check-in goes >1h missed. We'll add a **persistent, loud, looping alarm** that fires whenever the app opens/foregrounds and finds an unresolved missed check-in still inside the alert window, and keeps repeating until the guardian taps **Dismiss**.

### 1. New setting: `guardianPersistentMissedAlarm`

In `src/hooks/useUserSettings.ts`:
- Add field `guardianPersistentMissedAlarm: boolean` to `UserSettings`.
- Default to `true` in `DEFAULTS`.

In `src/pages/Settings.tsx` (Guardian Voice Alerts card, ~line 600):
- Add a new toggle row directly below `guardianVoiceAlerts`:
  - Label: "Persistent Missed Check-iN Alarm"
  - Description: "Loud repeating alarm (even on silent) when your ward misses a check-iN past the hour. Tap Dismiss to stop."
  - Bound to `settings.guardianPersistentMissedAlarm`.

### 2. New hook: `src/hooks/useGuardianAudio.ts`

Responsibilities:
- Run only when `role === "guardian"` and `!loginInProgress` and `settings.guardianPersistentMissedAlarm !== false`.
- Get accepted wards from `useGuardianWard().wards`.
- **Scan on mount, on `visibilitychange → visible`, and every 60s** for unresolved missed check-ins across all wards:
  ```ts
  supabase.from("check_ins")
    .select("id, user_id, scheduled_at, status")
    .in("user_id", wardUserIds)
    .eq("status", "missed")
    .gte("scheduled_at", todayStartIST)
    .lte("scheduled_at", nowMinus1hISO)   // past the hour
  ```
  Exclude any check-in whose id is in a `localStorage` dismissed set (key: `guardian_dismissed_missed_checkins`, scoped per IST day, auto-cleared at midnight IST).
- If at least one unresolved missed check-in exists, **start the alarm loop**:
  - Use a shared looping function similar to `playLoudAlertSequence` (3-burst high-gain chime ~880/988/1175Hz at gain ~0.9) followed by a spoken line: "Attention Guardian. {wardName} has missed their {hh:mm} Check-iN. Please check on them."
  - Repeat the full sequence every ~12s while unresolved.
  - Trigger vibration `[400,200,400,200,400]` each cycle (best-effort; silent phones still hear audio via WebAudio which bypasses media-volume mute on most browsers — same approach as user-side check-in alarm).
- Show a single **persistent overlay** (new lightweight `GuardianMissedAlarmOverlay` rendered from `AppLayout`) containing:
  - Title "Missed Check-iN — {wardName}"
  - Message: time + how long ago
  - List of all currently unresolved missed check-ins (id + ward + time)
  - One **Dismiss** button (primary, large). Tapping it:
    1. Stops the audio loop and clears the repeat interval.
    2. Adds every currently-flagged check-in id to the dismissed set in localStorage.
    3. Hides the overlay.
- The loop also stops automatically if a re-poll returns zero unresolved items (e.g. ward checked in late, status flipped to `responded`).

### 3. Wire into `AppLayout.tsx`

- Add `useGuardianAudio()` inside a new `GuardianOnlyHooks` component, mounted when `role === "guardian" && !loginInProgress`.
- Render `<GuardianMissedAlarmOverlay />` alongside other overlays when `role === "guardian" && !loginInProgress`.

### 4. Interaction with existing logic

- The current one-shot `fetchMissedEvents` voice line in `GuardianDashboard.tsx` stays gated on `settings.guardianVoiceAlerts` and continues to work for the dashboard-page mini popup. The new hook is global (runs on every guardian page) and handles the persistent loop independently.
- Audio respects: `loginInProgress=false`, `settings.guardianPersistentMissedAlarm=true`. It is **independent of `audioAlerts`/`voiceReminders`** (which are user-side settings) — guardians have their own toggle.
- No DB schema changes, no edge function changes.

### Files

- `src/hooks/useUserSettings.ts` — add field + default
- `src/pages/Settings.tsx` — add toggle row
- `src/hooks/useGuardianAudio.ts` — **new**
- `src/components/GuardianMissedAlarmOverlay.tsx` — **new** (simple full-width banner with Dismiss button; imperative `show/hide` API similar to `ReminderOverlay`)
- `src/components/AppLayout.tsx` — mount hook + overlay for guardians

### Out of scope

- No new DB tables or migrations.
- No changes to ward-side check-in flow or `check-missed-checkins` edge function.
- No medication-missed audio loop (this plan only covers check-iNs as requested).
