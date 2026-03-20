# Fix Check-In Alerts: Connect Settings to Audio + Add Visual Alerts

## Root Cause

There are **three disconnected problems**:

1. **Settings toggles don't control audio** — The Settings page writes `audioAlerts` and `voiceReminders` to the database (`user_settings.settings` JSONB), but `useCheckInAudio` reads from a **different** localStorage key (`checkin-audio-mode`) via `getAudioMode()`. These are never synced, and `getAudioMode()` defaults to `"off"`.
2. **No visual alerts (toasts)** — When a check-in is due or missed, there's no toast notification shown to the user. Only the CheckInCard UI changes passively.
3. **Narrow audio window** — Audio only fires within the first 2 minutes of the check-in hour. If the app loads after that, nothing happens. No repeat nudges.

## Plan

### 1. Bridge settings to audio mode (`src/hooks/useCheckInAudio.ts`)

Instead of reading `getAudioMode()` from localStorage, read the user's actual settings:

- Import `useUserSettings`
- If `settings.voiceReminders` is true → use voice mode
- If `settings.audioAlerts` is true → use chime mode
- Otherwise → off
- Remove the dependency on the orphaned localStorage key

### 2. Add toast + repeat nudges (`src/hooks/useCheckInAudio.ts`)

- When a check-in is due (current hour matches a CHECK_IN_HOURS), show a **toast notification** ("Time for your Check-iN! Tap the heart.") in addition to audio
- Fire the alert within the first **5 minutes** (not 2) of the window
- Add a **missed check-in nudge**: if 30+ minutes past a check-in hour and no response recorded, show a warning toast ("You missed your 12:00 PM Check-iN") and play the alert again and trigger a SOS to the guardians with location, last recorded health details and call button for flash call to User by email and SMS / WhatsApp (when this made available)  
- Query `check_ins` status to know if already responded (avoid alerting after check-in)

### 3. Add vibration support (`src/hooks/useCheckInAudio.ts`)

- If `settings.vibration` is true, call `navigator.vibrate([200, 100, 200])` alongside audio alerts

### 4. Remove orphaned localStorage audio mode (`src/lib/audioAlerts.ts`)

- Keep `playChime()` and `playVoiceReminder()` utility functions
- Remove `getAudioMode()`, `setAudioMode()`, `testAlert()` as they use the disconnected localStorage — replace callers with the settings-based approach
- Update `AlarmSettings.tsx` and `CheckInCard.tsx` to use `useUserSettings` instead of `getAudioMode()`

### Files Changed

- `src/hooks/useCheckInAudio.ts` — rewrite to use `useUserSettings`, add toasts, vibration, missed detection
- `src/lib/audioAlerts.ts` — remove orphaned localStorage functions, keep play utilities
- `src/components/CheckInCard.tsx` — remove direct `getAudioMode()` calls, use settings
- `src/components/medications/AlarmSettings.tsx` — update test alarm to not use removed functions
- `src/pages/GuardianDashboard.tsx` — update audio import if needed

### No database changes needed

All check-in status data already exists in the `check_ins` table.