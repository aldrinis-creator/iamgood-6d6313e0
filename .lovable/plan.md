

# Auto-Clear Notifications + Manual Clear Button

## Approach

1. **Auto-cleanup via pg_cron**: Schedule a daily database job that deletes notifications older than 7 days. This keeps the table lean without any client-side logic.

2. **Manual "Clear All" button**: Add a "Clear" button to both the user's `NotificationCenter` (bell icon sheet) and the guardian's `GuardianAlerts` page. This deletes all read notifications immediately, giving users control.

## Changes

### 1. Database: pg_cron job for 7-day auto-delete
- Schedule a daily cron job that runs `DELETE FROM notifications WHERE created_at < now() - interval '7 days'`
- Uses existing pg_cron + pg_net extensions

### 2. `src/components/NotificationCenter.tsx`
- Add a "Clear" button next to "Mark all read" in the header
- On click, delete all read notifications from the database and update local state
- Show confirmation before clearing

### 3. `src/pages/GuardianAlerts.tsx`
- Add a "Clear" button next to "Mark all read"
- Same logic: deletes read notifications from the database

### 4. Database: RLS policy update
- Currently notifications table has no DELETE policy for users
- Add DELETE policies so users and guardians can delete their own notifications

## Files

| File | Change |
|------|--------|
| Database (cron job) | Daily cleanup of notifications > 7 days |
| Database (migration) | Add DELETE RLS policies on notifications |
| `src/components/NotificationCenter.tsx` | Add "Clear" button for read notifications |
| `src/pages/GuardianAlerts.tsx` | Add "Clear" button for read notifications |

