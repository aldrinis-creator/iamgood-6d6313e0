## Summary
Change the Check-iN pre-window across the app so users can check in up to **1 hour before** each scheduled slot (7 AM, 12 PM, 7 PM IST), instead of the current 30 minutes.

## Affected files & changes

### Frontend logic
- **`src/components/CheckInCard.tsx`**
  - Update `getCurrentWindow()`: `earlyStart` offset from `-30` to `-60` minutes.
  - Update `getCurrentWindow()`: window-end overlap buffer from `-30` to `-60` minutes.
  - Update `getNextCheckInTime()`: `earlyStart` offset from `-30` to `-60` minutes.
  - Update `loadCurrentCheckIn()`: query window-end overlap buffer from `-30` to `-60` minutes.
  - Update approaching threshold in countdown effect: `minsLeft <= 30` → `minsLeft <= 60`.
  - Update early-check-in handler: `minsLeft <= 30` → `minsLeft <= 60`.

- **`src/hooks/useCheckInAudio.ts`**
  - Update the pre-alert browser notification threshold from `PRE_ALERT_MIN = 5` to `PRE_ALERT_MIN = 60` (or add a separate early-window constant) so the T-5 logic aligns with the new 1-hour window if needed. **Clarification needed:** do you want any audio/browser reminder during that 60-minute pre-window, or only at T-5 as today?

### Backend logic
- Edge functions (`check-missed-checkins`, `send-checkin-push`) operate on `scheduled_at` and post-due grace periods; they are **not** affected by the pre-window change.

## Open question
Do you want a browser/audio reminder at T-60 (when the window first opens), or keep the reminder at T-5 only and simply allow the heart tap to work starting 60 minutes early?