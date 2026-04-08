

## Prevent Duplicate Notifications and Auto-Delete After 48 Hours

### Problem
1. Same notification can be inserted multiple times (e.g., repeated medication missed alerts, duplicate zone exit alerts)
2. Current cleanup job deletes notifications after 7 days — needs to be 48 hours

### Changes

**1. Update the existing cron job to 48 hours**

Change the `cleanup-old-notifications` cron job from `7 days` to `48 hours`. Run via SQL insert tool (not migration).

**2. Add a unique constraint to prevent duplicate notifications**

Add a database-level deduplication mechanism — a unique index on `(user_id, type, title, message)` scoped to a time window. This uses a generated column that truncates `created_at` to the hour, so the same notification can't be inserted twice within the same hour.

Alternatively (simpler): add a check before each insert across the 12 notification insertion points.

**Recommended approach**: Add a database function `insert_notification_if_new` that checks for duplicates within the last 60 minutes before inserting. Then update all 12 call sites to use this function (or keep it simple with a partial unique index).

**Simplest approach chosen**: 
- Create a partial unique index on `(user_id, type, title)` with a condition that only applies to recent rows — Postgres doesn't support this easily with time windows in unique indexes
- Instead: create a helper DB function `insert_notification_deduped` that checks for an existing identical notification (same `user_id`, `type`, `title`) created within the last 60 minutes before inserting

**3. Update all notification insertion points**

Replace direct `.insert()` calls with the deduplication function across all 12 files, or wrap the logic in a database function callable via `.rpc()`.

### Implementation Details

| Action | Detail |
|--------|--------|
| SQL (insert tool) | Update cron job: `interval '48 hours'` instead of `7 days` |
| SQL (migration) | Create `insert_notification_deduped` DB function |
| Modify | All 12 files that insert notifications → use `supabase.rpc("insert_notification_deduped", {...})` or add a pre-check query |

### Files to Modify

- `src/hooks/useAbnormalPatternCheck.ts`
- `src/hooks/useJourneyTracker.ts`
- `src/hooks/useMedicationAlarms.ts`
- `src/hooks/useLocationSync.ts`
- `src/components/CheckInDialog.tsx`
- `src/contexts/AppContext.tsx`
- `src/pages/GuardianDashboard.tsx`
- `src/pages/UserDashboard.tsx`
- `supabase/functions/send-sos-alert/index.ts`
- `supabase/functions/guardian-nomination-response/index.ts`
- `supabase/functions/notify-vital-anomaly/index.ts`
- `supabase/functions/notify-guardian-medication/index.ts`

