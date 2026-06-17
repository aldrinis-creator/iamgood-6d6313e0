## Plan

1. **Fix the real repeat source**
   - The user-side `useCheckInAudio` still has an uncapped initial due alarm at T+0/T+15, separate from the three missed reminders.
   - The guardian-side `useGuardianAudio` also intentionally loops every 12 seconds until dismissed, which can create many repeated audio alerts for a ward like Aldrin after the check-in is marked missed.

2. **Add a persistent per-slot audio limiter**
   - Store alert counts in `localStorage` by user/ward + scheduled check-in slot + day.
   - This survives React remounts, route changes, visibility changes, and page reloads.
   - Enforce `MAX_AUDIO_ALERTS = 3` before any call to `playVoiceReminder`, `playChime`, `playLoudAlertSequence`, or vibration for missed check-ins.

3. **Apply the limiter in both audio hooks**
   - `src/hooks/useCheckInAudio.ts`: route all due/missed check-in audio through one capped function so the total is never above 3 for the slot.
   - `src/hooks/useGuardianAudio.ts`: replace the unlimited 12-second loop with a capped sequence of at most 3 guardian audio alerts per missed ward check-in; keep the overlay visible until dismissed.

4. **Keep escalation and UI behavior intact**
   - The final missed-check-in overlay and backend guardian escalation still happen.
   - Only excess audio/vibration is suppressed after the 3rd alert.
   - Alerts remain restricted by role: wards get local check-in reminders; guardians get guardian missed-alarm notifications only.

5. **Validate the fix**
   - Confirm code paths show no uncapped missed-check-in audio calls remain.
   - Verify the counter persists through hook remount/reload logic by inspecting the storage-backed limiter usage.