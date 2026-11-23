# Quiet period after sign-up / login, then pop-ups one at a time

## What changes for people
- While signing up or logging in, no pop-ups appear at all (already true for most; this makes it complete).
- For **15 minutes after a successful sign-in or sign-up**, reminder-type pop-ups stay quiet: medicine reminders, refill pop-up, morning briefing, guardian/ward "ping" messages, missed check-in alarm on the guardian app, safe zone pop-ups, battery warning, cookie banner, and their chimes.
- After 15 minutes, any pop-ups that are waiting appear **one at a time**. The next one shows only after the current one is closed.
- **Safety exceptions (never delayed):** an active SOS, fall detection and the SOS emergency screen still show immediately. Delaying these could put a Ward at risk.
- Phone notifications when the app is closed are not changed.
- The 15 minutes is remembered on the phone, so reopening the app in that window does not restart or skip it.

## Technical details
- `AuthContext`: on successful sign-in/sign-up, store `quietUntil = now + 15 min` in localStorage (per user id); expose `quietPeriodActive` (timer flips it off).
- New `PopupQueue` context in `AppLayout`: non-emergency overlays call `request(id, priority)` and render only when `current === id`; `release(id)` on close advances the queue. Priority order: missed medication/check-in > refill > pings > safe zone > morning briefing > battery > cookie.
- Wrap `ReminderOverlay`, `RefillDuePopup`, `MorningBriefingOverlay`, `GuardianPingOverlay`, `UserPingOverlay`, `GuardianMissedAlarmOverlay`, `GuardianSafeZoneOverlay`, `SafeZoneExitPrompt`, `BatteryWarning`, `CookieConsent` with the queue; their audio hooks also skip while `quietPeriodActive`.
- Leave `EmergencyModeOverlay`, `FallDetectionOverlay`, `SOSActiveBar` untouched.
- Alarm data/escalations on the server keep running unchanged (guardian WhatsApp/SMS unaffected).
- Add a small test for the queue (one at a time, priority order) and the 15-minute window.
