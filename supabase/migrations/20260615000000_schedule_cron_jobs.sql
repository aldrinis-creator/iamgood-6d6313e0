-- ============================================================
-- Check-iN: Schedule pg_cron jobs for missed check-in and
-- missed medication escalation
--
-- Run this migration once in the Supabase SQL editor.
-- pg_cron extension is already enabled (see prior migrations).
--
-- Both edge functions use deduplication guards so concurrent
-- runs (cron + client direct invoke) are safe.
-- ============================================================

-- 1. Schedule check-missed-checkins every 10 minutes
--    Runs at :00, :10, :20, :30, :40, :50 past the hour.
--    Picks up any pending check_ins older than 60 minutes
--    that the client escalation may have missed (e.g. phone
--    was off, PWA tab was closed, or background throttled).
SELECT cron.schedule(
  'check-missed-checkins',           -- job name (unique)
  '*/10 * * * *',                    -- every 10 minutes
  $$
    SELECT net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/check-missed-checkins',
      body   := '{"triggeredBy":"cron"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
      )
    );
  $$
);

-- 2. Schedule check-missed-medications every 10 minutes
--    Same cadence. Reads medication_logs WHERE status='missed'
--    AND whatsapp_alerted_at IS NULL — the client writes the
--    missed log row first, then invokes the function directly.
--    The cron acts as the fallback for offline/background cases.
SELECT cron.schedule(
  'check-missed-medications',        -- job name (unique)
  '*/10 * * * *',                    -- every 10 minutes
  $$
    SELECT net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/check-missed-medications',
      body   := '{"triggeredBy":"cron"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
      )
    );
  $$
);

-- 3. Verify both jobs are registered
-- (Run this SELECT manually to confirm after applying migration)
-- SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
