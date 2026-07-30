## The parameters the Guardian pop-up alarm is defined by

The alarm (`useGuardianAudio` + `GuardianMissedAlarmOverlay`) fires only when ALL of these hold:

1. Signed-in account role is `guardian`, and login is finished (`loginInProgress` false).
2. Setting `guardianPersistentMissedAlarm` is not `false` (default ON).
3. The guardian has at least one ward with `guardians.status = 'accepted'`.
4. A `check_ins` row for that ward has `status = 'missed'`.
5. That row's `scheduled_at` is today (from local midnight) AND at least 1 hour in the past.
6. The check-in id is not in the guardian's local "dismissed today" list.
7. Audio repeats every 12 seconds, capped at 3 audio plays per check-in per day (`MAX_AUDIO_ALERTS`); the visual overlay stays until "Dismiss Alarm".
8. Re-scan happens every 60 seconds and on app foreground (visibilitychange).

Server-side, a check-in only becomes `missed` when the `check-missed-checkins` job runs (every 10 min) and the slot is more than 35 minutes past due, the user isn't guardian-role, and isn't in Sleep / Checked-Out mode.

## Why it is not firing (verified)

- The database has **zero `check_ins` rows with status `missed` in the last 7 days** — only `pending` and `responded`. Condition 4 can therefore never be satisfied, so the overlay never shows.
- Rows stay `pending` forever: e.g. today's 12:00 IST slot for ward b56f6b1e (created 06:15 UTC) is still `pending` at 08:07 UTC, ~1.5 h past due and well beyond the 35-minute grace.
- Cause: the `check-missed-checkins-every-10min` cron job posts with an **anon-key bearer token**, not the service-role key. The function requires either the service-role bearer or a valid user JWT, so it returns **401** and exits before marking anything missed. Edge logs confirm 401 responses for this function (and for `send-checkin-push`, `send-medication-push`, `check-missed-medications` — same anon-token pattern).

Secondary observation: the account used in testing (`b56f6b1e…`) has role `guardian` in both `profiles` and `user_roles`, so even after the cron is fixed its check-ins would be silently dismissed without alerts. Guardian-facing testing needs a true `user`-role ward.

## Plan

1. **Repair cron authentication.** Re-create the affected cron jobs (`check-missed-checkins`, `check-missed-medications`, `send-checkin-push`, `send-medication-push`, and the other anon-token jobs) so the `Authorization` header carries the service-role key instead of the anon key, via a migration that reads the key from Vault rather than hard-coding it.
2. **Backfill.** One-time update marking stale overdue `pending` check-ins from previous days as `missed` (silently, no alerts) so the backlog does not trigger a burst of alarms, leaving only today's genuinely overdue slots to alert.
3. **Verify end-to-end.** After the fix, confirm via query that `check_ins` rows transition `pending → missed` at T+35, and that a guardian account with an accepted `user`-role ward sees the overlay and hears the looping alert.
4. **Guard against silent recurrence.** Add a log line / early-return distinction in `check-missed-checkins` so an auth rejection is clearly visible, and confirm from edge logs that the job now returns 200.

## Technical notes

- Files involved: `supabase/functions/check-missed-checkins/index.ts` (auth check at lines 127-146), `src/hooks/useGuardianAudio.ts`, `src/components/GuardianMissedAlarmOverlay.tsx`, `src/lib/checkInAudioLimiter.ts`.
- No change is needed to the client alarm logic itself — it is correct; it is starved of `missed` rows.
- One nuance to decide during implementation: `useGuardianAudio` computes "today" from device local midnight while the rest of the system uses IST. For India-based devices this is identical; the plan keeps it consistent by switching that boundary to IST as part of the fix.
