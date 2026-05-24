## Schedule `send-consolidated-alerts` every 4 hours

Set up a `pg_cron` + `pg_net` job that calls the `send-consolidated-alerts` edge function at minute 0 of every 4th hour (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC).

### Steps

1. Ensure extensions `pg_cron` and `pg_net` are enabled in the database.
2. Insert (not migrate) the cron schedule using the SQL you provided — schedules contain the project URL + anon key and must not be in migrations (so remixes don't inherit them).
3. Verify the job appears in `cron.job` and that the first run logs a 200 in `net._http_response`.

### SQL to run

```sql
SELECT cron.schedule(
  'invoke-consolidated-alerts',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url:='https://magnrdegcegxdtgapyez.supabase.co/functions/v1/send-consolidated-alerts',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ25yZGVnY2VneGR0Z2FweWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTI5MTYsImV4cCI6MjA4OTQyODkxNn0.GEsHJs4uD-UVrdlgepE6nbjZBmjDICGZ4sR6a3zMv48"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
```

### Note on timing

Cron runs in **UTC**, not IST. `0 */4 * * *` fires at 05:30, 09:30, 13:30, 17:30, 21:30, 01:30 IST. If you need IST-aligned slots (e.g. 08:00/12:00/16:00/20:00 IST), tell me and I'll adjust the cron expression.  
Yes, we need IST-aligned slots of 8am, 12pm, 4pm and 8pm.

### Note on auth

The job uses the anon key. If `send-consolidated-alerts` validates JWT / requires service-role, the call will 401 — say the word and I'll switch to the service role key (kept server-side in the cron definition only).  
Yes. switch to service role.

&nbsp;