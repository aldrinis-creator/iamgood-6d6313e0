SELECT cron.unschedule('weekly-guardian-report');

SELECT cron.schedule(
  'weekly-guardian-report',
  '30 3 * * 0',
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