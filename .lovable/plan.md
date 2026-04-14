

## Fix 4 Security Vulnerabilities

### 1. Nullify OTP codes after verification (Critical)

**Problem**: Plaintext OTP codes remain in `otp_events` indefinitely, creating a data exposure risk.

**Fix**: In `supabase/functions/send-otp/index.ts`, after successful verification (where we update status to `verified`), also set `otp_code = null`. Additionally, in the `cleanup-expired-otps` edge function, null out codes on all expired-but-not-yet-deleted rows.

```sql
-- In send-otp verify block, change the update to:
UPDATE otp_events SET verified = true, status = 'verified', otp_code = NULL WHERE id = otpRow.id;
```

**Files**: `supabase/functions/send-otp/index.ts`, `supabase/functions/cleanup-expired-otps/index.ts`

---

### 2. Scope Realtime channels (Critical)

**Problem**: Several Realtime subscriptions lack a `filter` parameter, meaning any authenticated user can subscribe and receive all rows from `notifications`, `guardian_pings`, and `journey_updates`.

**Fix**: Add `filter: \`user_id=eq.\${userId}\`` (or equivalent scoping column) to every `.on("postgres_changes", ...)` call that currently omits it.

Affected files and channels:
- `src/pages/GuardianAlerts.tsx` — `notifications` table, no filter → add `filter` by guardian_id lookup
- `src/components/NotificationCenter.tsx` — `notifications`, no filter → add `user_id` filter
- `src/components/NavTabs.tsx` — `notifications` channel (no filter), `guardian_pings` channels (no filter) → add filters
- `src/pages/GuardianDashboard.tsx` — `notifications` channel (no filter) → add filter
- `src/pages/Messages.tsx` — `guardian_pings` INSERT (no filter) → add `user_id` filter
- `src/components/GuardianJourneyTracker.tsx` — `journey_updates` INSERT (no filter) → add `user_id` filter
- `src/hooks/useRefillDue.ts` — `medications` (no filter) → add `user_id` filter
- `src/components/WardMedicationStatus.tsx` — check if filter exists, add if missing

Note: RLS still protects the actual data returned by queries, but unscoped channels leak row metadata (event type, timestamps) and could cause unnecessary function invocations.

**Files**: 8 frontend files listed above

---

### 3. Hide nomination tokens from ward SELECT (Warning)

**Problem**: When a ward queries the `guardians` table, the `nomination_token` column is included, which could allow token harvesting.

**Fix**: Create a database migration that:
- Drops the existing ward SELECT policies
- Recreates them using a column list via a view, OR more practically: update the frontend code to never select `nomination_token`, and create a security definer function that returns guardian data without the token column.

Simpler approach: Create an RLS-safe view `guardians_safe` that excludes `nomination_token`, or update the frontend queries in `Settings.tsx` and `GuardianTab.tsx` to explicitly select only needed columns (excluding `nomination_token`). The token is only needed by the edge function (which uses service_role and bypasses RLS).

**Files**: `src/pages/Settings.tsx`, `src/components/GuardianTab.tsx` — change `.select("*")` to explicit column list excluding `nomination_token`

---

### 4. Restrict coupon access (Warning)

**Problem**: The RLS policy `Users can read active coupons` allows any authenticated user to read all active coupon codes, discount values, and usage counts.

**Fix**: Remove the authenticated SELECT policy. Coupon validation already happens via the `validate-coupon` edge function which uses `service_role`. Users should not be able to browse coupons directly.

**Migration**:
```sql
DROP POLICY "Users can read active coupons" ON public.coupons;
```

Then verify the `validate-coupon` edge function uses `SUPABASE_SERVICE_ROLE_KEY` (it already does).

**Files**: New migration only. No frontend changes needed since the Subscription page already calls the edge function.

---

### Summary of changes

| # | Severity | Fix | Files |
|---|----------|-----|-------|
| 1 | Critical | Null OTP codes after verify | 2 edge functions |
| 2 | Critical | Add `filter` to all Realtime channels | 8 frontend files |
| 3 | Warning | Select explicit columns, exclude token | 2 frontend files |
| 4 | Warning | Drop public coupon SELECT policy | 1 migration |

