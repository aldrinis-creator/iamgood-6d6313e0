
-- 1. Add is_trial column to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

-- 2. Add trial_started_at to profiles (one trial per user, forever)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

-- 3. Function to expire stale subscriptions and notify trial users
CREATE OR REPLACE FUNCTION public.expire_stale_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_row RECORD;
  expired_count integer := 0;
BEGIN
  FOR expired_row IN
    UPDATE public.subscriptions
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at < now()
    RETURNING id, user_id, is_trial
  LOOP
    IF expired_row.is_trial THEN
      PERFORM public.insert_notification_deduped(
        expired_row.user_id,
        'Your free trial has ended',
        'Your 7-day Premium trial has ended. Upgrade to keep your Pro features.',
        'trial_ended',
        NULL
      );
    END IF;
    expired_count := expired_count + 1;
  END LOOP;

  RETURN expired_count;
END;
$$;

-- 4. Enable required extensions for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Schedule hourly expiry job (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-subscriptions-hourly') THEN
    PERFORM cron.unschedule('expire-stale-subscriptions-hourly');
  END IF;
  PERFORM cron.schedule(
    'expire-stale-subscriptions-hourly',
    '0 * * * *',
    $cron$ SELECT public.expire_stale_subscriptions(); $cron$
  );
END $$;
