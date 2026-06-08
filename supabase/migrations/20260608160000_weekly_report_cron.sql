-- Create function to invoke weekly reports edge function
CREATE OR REPLACE FUNCTION public.send_weekly_reports_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _service_key text;
  _response_id bigint;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF _service_key IS NULL THEN
    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  END IF;

  -- Call the Edge Function via pg_net (tries different possible schemas)
  BEGIN
    SELECT net.http_post(
      url := 'https://magnrdegcegxdtgapyez.supabase.co/functions/v1/send-weekly-reports',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := '{}'::jsonb
    ) INTO _response_id;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      SELECT extensions.http_post(
        url := 'https://magnrdegcegxdtgapyez.supabase.co/functions/v1/send-weekly-reports',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        ),
        body := '{}'::jsonb
      ) INTO _response_id;
    EXCEPTION WHEN OTHERS THEN
      SELECT http_post(
        url := 'https://magnrdegcegxdtgapyez.supabase.co/functions/v1/send-weekly-reports',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        ),
        body := '{}'::jsonb
      ) INTO _response_id;
    END;
  END;
END;
$$;

-- Schedule the job to run every Sunday at 03:30 AM UTC (9:00 AM IST)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-weekly-reports-sunday') THEN
    PERFORM cron.unschedule('send-weekly-reports-sunday');
  END IF;
  
  PERFORM cron.schedule(
    'send-weekly-reports-sunday',
    '30 3 * * 0', -- 03:30 AM UTC on Sunday
    $$SELECT public.send_weekly_reports_job();$$
  );
END $$;
