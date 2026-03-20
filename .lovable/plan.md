

# Fix Activity Tracker — RLS + Error Visibility

## Root Cause

The `activity_logs` table's INSERT, SELECT, UPDATE, and DELETE RLS policies are granted `TO public` (anon role). In Supabase, while `public` technically includes all roles, best practice is `TO authenticated` for logged-in user operations — and several other working tables in this project (e.g. `wellness_logs`, `face_scans`) use `TO authenticated`. The mismatch may cause silent failures depending on Supabase configuration.

Additionally, the `maybeSingle()` query checking for existing rows doesn't capture errors — if it fails, the flow silently proceeds to an insert that may also fail.

## Changes

### 1. Database Migration — Fix RLS policies on `activity_logs`

Drop and recreate all four user policies with `TO authenticated` (matching the pattern used by `wellness_logs` and other working tables):

```sql
DROP POLICY IF EXISTS "Users can insert own activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can select own activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can update own activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can delete own activity_logs" ON activity_logs;

CREATE POLICY "Users can insert own activity_logs" ON activity_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own activity_logs" ON activity_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own activity_logs" ON activity_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activity_logs" ON activity_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

### 2. `src/components/ActivityTracker.tsx` — Add error handling for the existence check

Capture the error from the `maybeSingle()` call. If it errors, log it and fall through to insert. Also add a `console.log` confirming save was triggered with the payload, so we have visibility if the issue persists.

