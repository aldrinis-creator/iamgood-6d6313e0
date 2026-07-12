
-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Dispatcher: called from AFTER INSERT trigger on sos_events
CREATE OR REPLACE FUNCTION public.dispatch_sos_alert(_sos_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  svc_key text;
BEGIN
  SELECT decrypted_secret INTO svc_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF svc_key IS NULL THEN
    RAISE WARNING 'dispatch_sos_alert: service role key not in vault';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://magnrdegcegxdtgapyez.supabase.co/functions/v1/send-sos-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key,
      'Lovable-Context', 'sos-server-dispatch'
    ),
    body := jsonb_build_object('sos_event_id', _sos_event_id)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_sos_alert failed for %: %', _sos_event_id, SQLERRM;
END;
$$;

-- AFTER INSERT trigger on sos_events
CREATE OR REPLACE FUNCTION public.sos_events_after_insert_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM public.dispatch_sos_alert(NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sos_events_after_insert_dispatch: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sos_events_dispatch ON public.sos_events;
CREATE TRIGGER trg_sos_events_dispatch
AFTER INSERT ON public.sos_events
FOR EACH ROW
EXECUTE FUNCTION public.sos_events_after_insert_dispatch();

-- Safety-net sweeper: re-dispatch any active SOS with no delivery attempts
CREATE OR REPLACE FUNCTION public.sos_dispatch_safety_net()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ev RECORD;
  n integer := 0;
BEGIN
  FOR ev IN
    SELECT se.id
    FROM public.sos_events se
    WHERE se.status = 'active'
      AND se.created_at > now() - interval '30 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM public.sos_message_attempts sma
        WHERE sma.sos_event_id = se.id
      )
    LIMIT 20
  LOOP
    PERFORM public.dispatch_sos_alert(ev.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Schedule the safety net every minute (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sos-dispatch-safety-net') THEN
    PERFORM cron.unschedule('sos-dispatch-safety-net');
  END IF;
  PERFORM cron.schedule(
    'sos-dispatch-safety-net',
    '* * * * *',
    $cron$ SELECT public.sos_dispatch_safety_net(); $cron$
  );
END $$;
