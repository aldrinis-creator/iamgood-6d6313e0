## Goal
When an appointment's selected alert time arrives (e.g. 15 min before, 1 hr before, etc.), play a loud, attention-grabbing audio alert — not just the current soft single chime / soft voice line.

## Current behavior
`src/hooks/useAppointmentAlarms.ts` already fires at the chosen lead time (5 min … 1 day). At fire time it calls either `playVoiceReminder` or `playChime` once. Both play at modest volume (chime gain ~0.4, single pass), so on phones in a pocket or on a desk it's easy to miss.

## Change
1. **Add a `playLoudAlertSequence(message)` helper** in `src/lib/audioAlerts.ts`:
   - 3 repeats of the chime at higher gain (~0.9 instead of 0.4), spaced ~1.2 s apart, so it sounds like a clear "ding-ding-ding" alarm.
   - Immediately follow with a spoken voice line ("Appointment reminder. {title} starts in {N} minutes.") at full volume.
   - On devices where `speechSynthesis` is unavailable, repeat the chime sequence a 4th time instead.
   - Respect existing `ensureAudioReady` priming so it works on iOS/Android web.

2. **Wire it into `useAppointmentAlarms.ts`** at the "At alert time" branch:
   - Replace the current `playVoiceReminder` / `playChime` branch with a single call to `playLoudAlertSequence(message)`.
   - Keep this loud alert **always on** for appointments at the selected alert time (matches the existing always-on medication alert pattern). Audio still gates on `pauseMode === "active"`, `loginInProgress` false, and `settings.audioAlerts` (so users who fully muted alerts in Settings stay muted). Voice line is included whenever audio is allowed — independent of `settings.voiceReminders`, because the appointment alert time is an explicit user-set reminder.
   - Vibration on supported devices is unchanged.
   - Overlay + browser notification flow unchanged.

3. **Pre-notification (T-5 before the alert time)** stays as a quiet browser notification only — no change.

## Files
- `src/lib/audioAlerts.ts` — add `playLoudAlertSequence`.
- `src/hooks/useAppointmentAlarms.ts` — call the new helper at fire time.

## Out of scope
- No DB changes, no new appointment fields, no Settings toggle (current `settings.audioAlerts` already acts as the global kill-switch).
- Guardian-side alerts are unchanged.
