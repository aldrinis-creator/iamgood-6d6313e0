# Diagnosis — Aldrin Alphonso, 7:00 PM IST Check-In (13 Jun 2026)

## What the data shows

From the database (IST):


| Slot     | Scheduled (IST)  | Responded (IST)  | Status        | Lag         |
| -------- | ---------------- | ---------------- | ------------- | ----------- |
| 7 AM     | 13 Jun 07:00     | 13 Jun 11:07     | responded     | +4h 07m     |
| 12 PM    | 13 Jun 12:00     | 13 Jun 13:40     | responded     | +1h 40m     |
| **7 PM** | **13 Jun 19:00** | **13 Jun 20:35** | **responded** | **+1h 35m** |


Aldrin's settings are correct: `checkInTimes: ["07:00","12:00","19:00"]`, `audioAlerts:true`, `voiceReminders:true`, `pauseMode:active`, `loginInProgress` not stuck. Role is `user` (eligible for local audio).

So the 7 PM check-in **was** completed — just very late (95 minutes after schedule).

## Why no audio alert played at 7:00 PM

The client hook `src/hooks/useCheckInAudio.ts` is what plays the chime / voice reminder. It only runs in the browser and only fires when the app is open. Its rules:

- **T-0 audio (line 102-111)** — plays the voice reminder/chime only inside the 5-minute window `0 ≤ diffMin < 5` after schedule, and only if `!firedRef.current.has(dueKey)`.
- **T+5 / T+15 / T+25 popup + audio (line 114-148)** — same window-based escalation, but only while `diffMin < 60`.
- **Hard cutoff (line 84-88)**: `if (diffMin >= 60) { missedSentRef.add(...); continue; }` — once you're more than 1 hour past schedule, the hook silently skips that slot for the rest of the day. No popup, no chime, no voice line, nothing.

Aldrin opened the app and tapped check-in at **20:35 IST = T+95 min**. By then the hook had already passed the 60-minute cutoff for the 19:00 slot, so it intentionally did nothing — no audio is by design once the slot is "too stale".

For audio to have played, the app must have been **foreground and unlocked** with audio permissions during 19:00–20:00 IST. The earlier slots (07:00 and 12:00) were also responded very late (+4h and +1h40m), which strongly suggests the app simply wasn't open during the audio window — this is a consistent pattern, not a one-off.

(Also worth noting: the same hook hardcodes `CHECK_IN_HOURS = [7, 12, 19]` rather than reading the user's `checkInTimes`. That happens to match Aldrin's settings, so it's not the cause here — but it's brittle for any user who customizes their times.)

## Why no "missed" alert was generated

Two layers handle "missed":

1. **Client UI ("Check-In Missed" overlay, line 158-163)** — only fires from inside the T+5…T+55 escalation path. Same 60-minute cutoff applies, and it also bails as soon as `isCheckInResponded(...)` returns true. Aldrin's row was eventually written with `status='responded'`, so no missed overlay would ever fire even if the app had been open.
2. **Server cron `check-missed-checkins**` — marks rows `status='missed'` and notifies guardians. The row for 19:00 IST has `status='responded'`, not `missed`, so the cron correctly did not classify it as missed and correctly did not alert guardians.

Result: from the system's point of view the 7 PM check-in was completed (late, but completed), so no missed-alert was warranted. The previous day (12 Jun) 19:00 slot is genuinely missed in the DB — that one would have been escalated by the cron.

## Summary

- **No 7 PM audio** = app wasn't open during the 0–60 min audio window; the hook intentionally goes silent past T+60. Working as designed.
- **No missed alert** = check-in was eventually responded (at 20:35 IST), so the slot is `responded`, not `missed`. Working as designed.

## Optional improvements (not implementing yet — pick any to schedule)

1. **Server-driven push at T-0 / T+10 / T+30** via `send-checkin-push` so alerts reach users when the app is closed (push notifications, independent of foreground audio).
2. **Read `settings.checkInTimes` in `useCheckInAudio**` instead of the hardcoded `[7,12,19]`, so custom schedules are honored.
3. **Late-response audio confirmation** — even when `diffMin >= 60`, if user opens the app and slot is unresponded, show a soft "You still have an unresponded 7 PM check-in" prompt instead of silently skipping.
4. **Surface late completions on the Guardian dashboard** (e.g. "responded 1h35m late") so caregivers see adherence drift even when nothing is technically "missed".

Tell me which of these (if any) you want me to implement and I'll move to build mode.

1