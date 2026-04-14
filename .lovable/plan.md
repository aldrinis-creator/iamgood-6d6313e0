

## Change Nomination Rule: Require Explicit Acceptance

### Current behavior
- Status defaults to `pending`, auto-accepts after 24 hours if not rejected
- Guardian gets access to health data, location, and SOS without ever confirming

### New behavior
- Status defaults to `pending`
- Guardian must click "Accept" in the invite link to become `accepted`
- If no action within **72 hours**, status changes to `expired`
- Ward is notified of expiry and can re-send
- Guardian can reject at any time within the window

### Changes

**1. Database migration**
- Add `expired` to any status checks or constraints
- Create a scheduled function (or pg_cron job) to mark nominations as `expired` where `status = 'pending'` and `nomination_expires_at < now()`
- Update `nomination_expires_at` default from 24h to 72h in the guardian creation logic

**2. Edge function: `guardian-nomination-response/index.ts`**
- Already handles accept/reject via token — no major changes needed
- Add expiry check: if `nomination_expires_at < now()` and still `pending`, return "Nomination has expired"

**3. UI updates (`src/pages/Register.tsx`)**
- When guardian arrives via invite link with token, call the nomination-response edge function with `action: "accept"` after successful registration
- Show clear confirmation: "You have accepted the guardian nomination from [ward name]"

**4. UI updates (`src/components/GuardianTab.tsx` / Settings)**
- Show `expired` status badge (yellow/grey) alongside pending/accepted/rejected
- Add "Re-send Invite" button for expired nominations (already exists for pending, extend to expired)
- Update the 24-hour rejection window messaging to "Awaiting acceptance (expires in X hours)"

**5. Notification on expiry**
- The pg_cron job that expires nominations also inserts a notification for the ward: "Your guardian nomination to [name] has expired. Re-send the invite from Settings."

**6. `check-missed-checkins` or new cron function**
- Add a lightweight query to expire stale nominations, or create a dedicated `expire-stale-nominations` cron job

### Files to modify
- New migration — add expiry logic, pg_cron job
- `supabase/functions/guardian-nomination-response/index.ts` — add expiry check
- `src/pages/Register.tsx` — call accept on successful guardian registration
- `src/components/GuardianTab.tsx` — expired status badge + re-send for expired
- `src/pages/Settings.tsx` — update nomination_expires_at to 72h
- Ward notification insert in cron job

### Technical detail
```sql
-- Cron job to expire stale nominations (runs hourly)
SELECT cron.schedule('expire-stale-nominations', '0 * * * *', $$
  UPDATE public.guardians
  SET status = 'expired'
  WHERE status = 'pending'
    AND nomination_expires_at < now();
$$);
```

