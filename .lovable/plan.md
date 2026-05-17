## Problem

DLQ growth alert is caused by the welcome email being re-sent on every sign-in (not just first signup). The repeated calls reuse `idempotencyKey: welcome-${user.id}`, and the original "run" for that key has long expired, so the Email API rejects every retry with `410 run_expired`. After 5 retries per batch the messages move to the DLQ.

Domain `notify.futurewave.in` is verified. Provider is healthy. No DNS, suppression, or rate-limit issue.

## Fix

### 1. Send welcome email only once, on actual signup
In `src/contexts/AuthContext.tsx`, stop invoking `send-transactional-email` for "welcome" inside `onAuthStateChange`. Move/guard it so it fires exactly once per account:

- Track a `welcome_sent_at` (timestamptz, nullable) column on `profiles`.
- In the auth listener, only call the welcome email when `profile.welcome_sent_at IS NULL`. Immediately update the row to `now()` before invoking (so concurrent sign-ins on multiple devices don't double-fire).
- Alternative (simpler, no schema change): only fire welcome on the `SIGNED_UP` / first `SIGNED_IN` event when `event === 'SIGNED_IN'` AND profile was just created (e.g. `created_at` within the last 2 minutes). The DB column is cleaner — recommended.

### 2. Clear the current DLQ backlog
After the code fix is deployed:
- Open **Admin → Emails** dashboard.
- Inspect `auth_emails_dlq` (4 msgs) and `transactional_emails_dlq` (12 msgs).
- **Do not requeue** the welcome failures — they will fail again (same expired run). Discard/delete them from the DLQ.
- If any non-welcome messages are in the DLQ, evaluate individually and requeue if appropriate.

### 3. Suppress the alert noise during cleanup (optional)
The `email_alert_config.cooldown_minutes` already deduplicates, but if alerts keep firing while the backlog clears, temporarily raise `dlq_growth_threshold` in `email_alert_config`, then restore after cleanup.

## Files touched
- `src/contexts/AuthContext.tsx` — guard the welcome-email invoke.
- New migration — add `profiles.welcome_sent_at timestamptz` (if going with the column approach).

## Verification
1. Sign in as an existing user with `welcome_sent_at` set → confirm no `send-transactional-email` network call is made.
2. Create a brand-new account → confirm welcome email sends successfully and `welcome_sent_at` is populated.
3. Watch `email_send_log` for ~15 min: no new `welcome` rows with `run_expired`. DLQ depth stops growing.
4. Next `email-queue-health-check` cycle should not raise `dlq_growth`.

## Not in scope
- No changes to the email provider, domain, DNS, or `send-transactional-email` function itself — those are working correctly.
