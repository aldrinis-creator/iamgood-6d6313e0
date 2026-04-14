

## Fix False "Missed Check-In" SMS Alerts

### Root Cause (confirmed with database evidence)

The database shows duplicate check-in records for the same user + time slot (e.g., user `8d12aed0` has 3 records at the same slot, and user `8d12aed0` on Apr 9 has one "responded" and one "missed" for the same hour). Here is how the false alert happens:

1. `CheckInCard.loadCurrentCheckIn()` runs every 30 seconds. A race condition between two intervals (or page reload + interval) causes TWO "pending" records to be inserted for the same 7:00 AM slot.
2. User checks in at 7:15 AM → `handleCheckIn()` updates only ONE record by ID to "responded".
3. The orphaned duplicate stays "pending".
4. The `check-missed-checkins` cron runs → finds the orphaned "pending" record → marks it "missed" → sends SMS/email/push to guardians. **False alert.**

Additionally, `check-missed-checkins` queries guardians WITHOUT filtering `status = 'accepted'`, meaning even pending/expired guardians receive alerts.

### Fixes (3 layers of defense)

#### 1. Database: Add unique constraint (prevents duplicates at source)
Create a migration adding a unique constraint on `(user_id, scheduled_at)` in `check_ins`. This makes it impossible to create duplicate records for the same slot. Clean up existing duplicates first.

```sql
-- Remove duplicates keeping the best record (responded > pending > missed)
DELETE FROM check_ins a USING check_ins b
WHERE a.user_id = b.user_id 
  AND a.scheduled_at = b.scheduled_at 
  AND a.id < b.id
  AND (b.status = 'responded' OR a.status != 'responded');

ALTER TABLE check_ins ADD CONSTRAINT check_ins_user_slot_unique 
  UNIQUE (user_id, scheduled_at);
```

#### 2. Server: Cron must verify no "responded" record exists before alerting
**File: `supabase/functions/check-missed-checkins/index.ts`**

Before processing each pending check-in, query for ANY "responded" record in the same user+hour window. If one exists, silently mark the orphaned pending record as "responded" (not "missed") and skip all alerts.

Also add `status = 'accepted'` filter to the guardians query (line 203-206).

#### 3. Client: Use upsert and update ALL records for the window
**File: `src/components/CheckInCard.tsx`**

- `loadCurrentCheckIn()`: Use `.upsert()` with `onConflict: 'user_id,scheduled_at'` instead of insert, or wrap in a try-catch that ignores unique constraint violations.
- `handleCheckIn()`: After updating the primary record, also update ALL pending records for the same window to "responded" (not just the one by ID).

### Files to modify
- **Migration**: unique constraint + duplicate cleanup
- `supabase/functions/check-missed-checkins/index.ts` — add responded-check before alerting + filter guardians by accepted status
- `src/components/CheckInCard.tsx` — use conflict-safe insert + update all window records on check-in

