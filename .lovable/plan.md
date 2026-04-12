

## Fix: Duplicate SMS for Missed Check-Ins

### Root Cause Analysis

The database confirms 25 duplicate "Missed Check-In Alert" notifications created within 2 minutes, for only 1 guardian and 2 check-in records. The 6 identical SMS messages in your screenshot come from multiple overlapping sources:

**Problem 1 — `check-missed-checkins` marks check-ins as missed TOO LATE**
The cron runs every 10 minutes. The function sends SMS/notifications FIRST (line 209-320), then marks the check-in as "missed" LAST (line 324). If the function takes time or errors partway through, the next cron run picks up the same still-pending check-in and sends SMS again. With a check-in pending for 60+ minutes, that is up to 6 cron runs each sending SMS.

**Problem 2 — Direct `.insert()` bypasses deduplication**
The function uses `supabase.from("notifications").insert(...)` (line 211) instead of `insert_notifications_deduped` RPC, so every run creates a new notification regardless of whether one already exists.

**Problem 3 — Client-side `useCheckInAudio` also sends guardian notifications**
The client hook calls `notifyGuardiansMissedCheckin()` on final escalation (line 167). When the component remounts (page navigation), `postGraceRef` and `missedSentRef` reset, replaying the entire escalation sequence and firing more notifications.

### Fix Plan

**`check-missed-checkins/index.ts`** — 3 changes:
1. **Mark as missed FIRST, before sending any notifications.** Move the `update({ status: "missed" })` call to BEFORE the notification/SMS block. This prevents subsequent cron runs from re-processing the same check-in.
2. **Use `insert_notifications_deduped` RPC** instead of direct `.insert()` for notifications.
3. **Add MSG91 idempotency** — include the check-in ID in a dedup check. Before calling MSG91, check if a notification with `type: missed_checkin` already exists for this user+guardian+scheduled hour. If so, skip SMS.

**`useCheckInAudio.ts`** — 1 change:
- **Remove `notifyGuardiansMissedCheckin()` call** (line 167). The server-side cron is the single source of truth for guardian notifications and SMS. The client should only handle user-facing audio/visual reminders.

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/check-missed-checkins/index.ts` | Mark missed first, use deduped insert, add MSG91 dedup guard |
| `src/hooks/useCheckInAudio.ts` | Remove `notifyGuardiansMissedCheckin` call on final escalation |

