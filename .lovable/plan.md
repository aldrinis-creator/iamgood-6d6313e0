

# Fix: Check-In and Medication Audio Alerts Not Firing

## Root Causes Found

### 1. Audio unlock listeners are removed after first click
In `src/lib/audioAlerts.ts` lines 53-61, the click/touchstart handlers call `removeEventListener` after the first interaction. This means after a period of inactivity the AudioContext re-suspends and never gets unlocked again.

### 2. Check-in "missed" alerts only fire during the same hour
`useCheckInAudio.ts` line 88: `hour === h && minute >= 30` means the missed alert for 7AM only fires between 7:30-7:59. If the user opens the app at 8:15, no missed alert fires for the 7AM check-in.

### 3. Medication alarm window is too narrow (2 minutes)
`useMedicationAlarms.ts` line 55: `Math.abs(minute - (m || 0)) < 2` means the alarm only fires if the 30-second check loop happens to run within a 2-minute window of the scheduled time. Easy to miss entirely.

## Changes

### File: `src/lib/audioAlerts.ts`
- Keep click/touchstart listeners permanently (remove `removeEventListener` calls) so AudioContext gets re-unlocked on every user interaction
- Call `ensureAudioReady()` inside `playChime()` and `playVoiceReminder()` as a last-chance resume attempt

### File: `src/hooks/useCheckInAudio.ts`
- **DUE alerts**: Expand window from 5 minutes to the full check-in period (e.g., 7:00-11:59 for the 7AM slot) — fire once if not responded
- **MISSED alerts**: Check all past check-in hours for today (not just current hour). If a check-in hour has passed and no response exists, fire the missed alert. This handles the user opening the app hours after a missed check-in.

### File: `src/hooks/useMedicationAlarms.ts`
- Widen the current-time alarm window from 2 minutes to 10 minutes (`Math.abs(minute - m) < 10`) to account for the 30-second polling interval and minor timing mismatches
- This doesn't affect the missed-dose 60-minute logic which is already correct

## Files Changed
- `src/lib/audioAlerts.ts` — persistent unlock listeners
- `src/hooks/useCheckInAudio.ts` — wider alert windows for due and missed
- `src/hooks/useMedicationAlarms.ts` — wider current-time alarm window

