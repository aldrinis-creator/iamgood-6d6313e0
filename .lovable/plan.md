## Goal
Manually trigger the `weekly-guardian-report` edge function to verify Sunday's email pipeline end-to-end.

## Steps
1. Invoke `weekly-guardian-report` with `{ "triggeredBy": "manual" }` to bypass the Sunday-only guard.
2. Read the JSON response — capture `sent` count, any `errors[]`, and `weekLabel`.
3. If `send-transactional-email` rejects the `weekly-guardian-report` template, inspect its registry/handler and fix the registration or template-name mismatch, then re-invoke.
4. Check `email_send_log` for the resulting `pending` / `sent` rows keyed by the idempotency pattern `weekly-report-<guardianId>-<sunday>`.
5. Report back which guardians received the email, which were skipped (already sent), and any failures with the exact provider error surfaced.

## Notes
- No template or schema changes planned unless step 3 reveals a registration bug.
- Idempotency key already prevents duplicate sends for the current week, so re-runs are safe.
