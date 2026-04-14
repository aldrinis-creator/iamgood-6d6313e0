

## Enforce Day Boundaries and Add Timestamps to All Alerts

### Problem
1. **Spillover**: The `check-missed-checkins` cron has no upper date bound — it picks up stale "pending" records from previous days and sends false alerts.
2. **Client-side spillover**: `useCheckInAudio` allows post-grace reminders up to `diffMin < 1440` (24 hours), meaning yesterday's missed check-ins can trigger today's alerts. Same pattern in `useMedicationAlarms`.
3. **Missing timestamps**: Notification messages, browser notifications, SMS, and emails do not consistently include the current date and time, making it hard to identify when an alert was generated.

### Fixes

#### 1. Server: `check-missed-checkins` — add today-only date bound
**File: `supabase/functions/check-missed-checkins/index.ts`**

- Add an upper bound to the pending check-ins query: only fetch records where `scheduled_at` is within **today** (IST midnight to 23:59:59). Currently line 134-138 queries all pending records older than 10 minutes with no date ceiling.
- Compute today's IST boundaries (UTC+5:30) and add `.gte("scheduled_at", todayStartISO)` to the query.

#### 2. Client: `useCheckInAudio` — cap reminders at 23:59 today
**File: `src/hooks/useCheckInAudio.ts`**

- Line 103: Change `diffMin < 1440` to `diffMin < (24*60 - h*60)` or simpler: add a guard that `scheduledAt` is today (same `dateKey`). This prevents yesterday's missed check-in hours from firing reminders today.
- Simplest fix: before the post-grace loop, skip if `scheduledAt < todayStart`.

#### 3. Client: `useMedicationAlarms` — already day-scoped (confirmed OK)
The medication alarm hook uses `todayStart`/`todayEnd` for log queries, and `dateKey` for fired/missed refs. The `diffMin` checks are bounded by `HARD_CUTOFF_MIN + 15` (75 min max). No spillover risk here. No changes needed.

#### 4. Add IST date+time stamps to all alert messages

**File: `supabase/functions/check-missed-checkins/index.ts`**
- Include current IST date+time in the notification message, e.g. `"[14 Apr 2026, 10:30 AM] Ravi missed their 7:00 AM check-in..."`

**File: `supabase/functions/notify-guardian-medication/index.ts`**
- Include current IST timestamp in the notification `message` field and SMS body.

**File: `src/hooks/useMedicationAlarms.ts`**
- Add IST timestamp to `showBrowserNotification` and `showReminderOverlay` messages using `formatISTDateTime` from `src/lib/istTime.ts`.

**File: `src/hooks/useCheckInAudio.ts`**
- Add IST timestamp to `fireAlert` messages and `showReminderOverlay` messages.

**File: `src/hooks/useAppointmentAlarms.ts`**
- Add IST timestamp to appointment reminder messages.

**File: `src/hooks/useExerciseReminder.ts`**
- Add IST timestamp to exercise reminder messages.

### Summary

| # | Fix | Files |
|---|-----|-------|
| 1 | Cron: today-only query bound (IST) | `check-missed-checkins/index.ts` |
| 2 | Client: cap check-in reminders to today | `useCheckInAudio.ts` |
| 3 | Timestamps in all check-in alerts | `check-missed-checkins/index.ts`, `useCheckInAudio.ts` |
| 4 | Timestamps in all medication alerts | `notify-guardian-medication/index.ts`, `useMedicationAlarms.ts` |
| 5 | Timestamps in appointment/exercise alerts | `useAppointmentAlarms.ts`, `useExerciseReminder.ts` |

