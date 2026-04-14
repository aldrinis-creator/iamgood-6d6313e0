
-- Step 1: Remove duplicates, keeping the "best" record per (user_id, scheduled_at).
-- Priority: responded > missed > pending. Among ties, keep the latest id.
DELETE FROM check_ins a
USING check_ins b
WHERE a.user_id = b.user_id
  AND a.scheduled_at = b.scheduled_at
  AND a.id <> b.id
  AND (
    -- b has a better status
    (b.status = 'responded' AND a.status <> 'responded')
    OR
    -- same status, keep the one with the larger id (latest)
    (a.status = b.status AND a.id < b.id)
    OR
    -- a is pending, b is missed (missed > pending for keeping)
    (a.status = 'pending' AND b.status = 'missed')
  );

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE check_ins ADD CONSTRAINT check_ins_user_slot_unique UNIQUE (user_id, scheduled_at);
