## Problem

The `send-weekly-reports` edge function exists and is correctly gated to require a service-role bearer, but **no pg_cron job was ever created to invoke it**. Confirmed by listing `cron.job` — there is no entry matching `weekly` (jobs 1, 2, 3, 4, 6, 7, 10–13, 15, 18, 22, 28 exist; none target weekly reports). That is why no Sunday emails go out.

## Fix

Create a single pg_cron job that calls the edge function every Sunday at 09:00 IST.

- 09:00 IST = **03:30 UTC** Sunday → cron expression `30 3 * * 0`
- Use `net.http_post` to `https://<project>.supabase.co/functions/v1/send-weekly-reports`
- Send `Authorization: Bearer <SERVICE_ROLE_KEY>` so the in-function auth gate passes (anon key would be rejected with 401)
- Job name: `send-weekly-reports-sun-9am-ist`

Because the SQL contains the project URL and service-role key, it will be applied via `supabase--insert` (not via the migration tool), per the scheduled-jobs guidance — so remixes don't inherit our keys.

## Verification

1. After insert, re-query `cron.job` to confirm the new row is present and `active = true`.
2. Check `cron.job_run_details` after the next scheduled tick (or trigger a manual `net.http_post` once) to confirm a 200 response from the function.
3. Spot-check `email_send_log` for `template_name = 'weekly-report'` rows on the following Sunday.

## Out of scope

No code changes to `send-weekly-reports/index.ts` or the email template — both are already correct. This is purely a missing-scheduler fix.
