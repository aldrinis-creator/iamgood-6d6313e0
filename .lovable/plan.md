## Goal

Reduce credit burn from Cloud compute and over-frequent cron invocations.

## 1. Downsize the Cloud instance (you do this in the UI)

Instance sizing isn't changeable from code — it's a project setting. Steps:

1. Open the project → **Backend** (Lovable Cloud) → **Advanced settings**.
2. Under **Instance size**, pick the next tier down (e.g. Large → Medium, or Medium → Small).
3. Confirm. Resize takes a few minutes; the backend may briefly show `RESIZING`.

I'll verify health with `supabase--cloud_status` once you've triggered it. If the app feels sluggish after, we can step back up.

## 2. Slow the over-frequent cron job

Audit of `cron.job` shows the real offender is `**process-email-queue**` running every **5 seconds** (~17,280 invocations/day). The push-notification crons are already at 1/min — no change needed there.

Change:

- `process-email-queue`: **5 seconds →** `* * * * *` **(every 1 .5 minutes)**

That's ~99.7% fewer invocations. Trade-off: outbound emails (auth + transactional) may sit in the queue up to ~90s instead of ~5s. For auth OTPs and password resets that's still well within acceptable UX (users wait far longer for SMTP delivery anyway).

All other crons are already reasonable (1m, 5m, 10m, 15m, hourly, daily) — Change the 1m cron to 1.5 minutes. Rest is No Change.

## 3. Technical change

One SQL statement via `supabase--insert`:

```sql
SELECT cron.unschedule('process-email-queue');
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$SELECT net.http_post(... existing call ...)$$
);
```

I'll fetch the existing job's command first so the rescheduled job keeps the same URL, headers, and service-role bearer.

## 4. Verify

- `SELECT schedule FROM cron.job WHERE jobname='process-email-queue'` → confirms `* * * * *`.
- Check `email-queue-health-check` logs after ~10 min to confirm queue depth stays healthy.

No frontend or edge-function code changes.