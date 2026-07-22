## Context

You don't need to run that SQL manually — and on Lovable Cloud you actually can't (no Supabase dashboard access, and the service role key isn't exposed to paste in).

I checked the database and found:

1. `send-weekly-reports-sun-9am-ist` — already scheduled Sundays 03:30 UTC (9:00 AM IST), correctly authorized via the vault-stored service key. Working.
2. `weekly-guardian-report` — already scheduled at the same time, BUT its command uses `current_setting('app.supabase_service_key')`, which isn't configured on this project. Every Sunday run silently fails to authenticate against the edge function.

That's why guardians aren't getting the weekly report even though a job exists.

## Plan

One migration that re-registers the `weekly-guardian-report` cron job using the same vault-based auth pattern the other working cron uses.

```sql
SELECT cron.unschedule('weekly-guardian-report');

SELECT cron.schedule(
  'weekly-guardian-report',
  '30 3 * * 0',  -- Sunday 09:00 IST
  $$
    SELECT net.http_post(
      url     := 'https://magnrdegcegxdtgapyez.supabase.co/functions/v1/weekly-guardian-report',
      body    := '{"triggeredBy":"cron"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Lovable-Context','cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'email_queue_service_role_key'
        )
      )
    );
  $$
);
```

No code files change. The edge function `weekly-guardian-report` and its email template already exist and are deployed.

## Verification

After the migration runs, I'll:

- Confirm the job row shows the new vault-based command and `active = true`.
- Optionally invoke `weekly-guardian-report` once manually so you get this week's report immediately instead of waiting for Sunday.

## One question

There are now two Sunday-9am jobs sending weekly emails: `send-weekly-reports` (goes to users + guardians) and `weekly-guardian-report` (guardians only). Do you want both to keep running, or should I disable one to avoid guardians receiving two emails? Yes

&nbsp;