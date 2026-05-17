
-- 1. email_alert_config (single-row)
CREATE TABLE IF NOT EXISTS public.email_alert_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  dlq_growth_threshold integer NOT NULL DEFAULT 5,
  dlq_total_threshold integer NOT NULL DEFAULT 20,
  stuck_queue_minutes integer NOT NULL DEFAULT 10,
  no_send_window_minutes integer NOT NULL DEFAULT 30,
  bounce_rate_threshold numeric NOT NULL DEFAULT 5.0,
  complaint_rate_threshold numeric NOT NULL DEFAULT 0.1,
  rate_limit_alert_minutes integer NOT NULL DEFAULT 30,
  cooldown_minutes integer NOT NULL DEFAULT 120,
  extra_notification_emails text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.email_alert_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.email_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email alert config"
ON public.email_alert_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email alert config"
ON public.email_alert_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage email alert config"
ON public.email_alert_config FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. email_alert_log
CREATE TABLE IF NOT EXISTS public.email_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_alert_log_created_at ON public.email_alert_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_alert_log_type_created ON public.email_alert_log (alert_type, created_at DESC);

ALTER TABLE public.email_alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email alerts"
ON public.email_alert_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage email alerts"
ON public.email_alert_log FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3. email_queue_stats: returns depth + oldest age for each queue
CREATE OR REPLACE FUNCTION public.email_queue_stats()
RETURNS TABLE (
  queue_name text,
  depth bigint,
  oldest_age_seconds numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  q text;
  rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR q IN SELECT unnest(ARRAY[
    'auth_emails',
    'transactional_emails',
    'auth_emails_dlq',
    'transactional_emails_dlq'
  ])
  LOOP
    BEGIN
      EXECUTE format(
        'SELECT count(*)::bigint AS depth,
                COALESCE(EXTRACT(EPOCH FROM (now() - min(enqueued_at))), 0)::numeric AS oldest
         FROM pgmq.q_%I', q
      ) INTO rec;
      queue_name := q;
      depth := rec.depth;
      oldest_age_seconds := rec.oldest;
      RETURN NEXT;
    EXCEPTION WHEN undefined_table THEN
      queue_name := q;
      depth := 0;
      oldest_age_seconds := 0;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.email_queue_stats() TO authenticated, service_role;

-- 4. requeue_dlq_message: moves a DLQ message back to source queue
CREATE OR REPLACE FUNCTION public.requeue_dlq_message(
  dlq_name text,
  msg_id bigint
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  source_queue text;
  payload jsonb;
  new_id bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF dlq_name NOT IN ('auth_emails_dlq', 'transactional_emails_dlq') THEN
    RAISE EXCEPTION 'Invalid DLQ name: %', dlq_name;
  END IF;

  source_queue := replace(dlq_name, '_dlq', '');

  EXECUTE format('SELECT message FROM pgmq.q_%I WHERE msg_id = $1', dlq_name)
    INTO payload USING msg_id;

  IF payload IS NULL THEN
    RAISE EXCEPTION 'Message not found in %', dlq_name;
  END IF;

  -- Reset queued_at so TTL doesn't immediately expire
  payload := payload || jsonb_build_object('queued_at', now()::text, 'requeued_from_dlq', true);

  SELECT pgmq.send(source_queue, payload) INTO new_id;
  PERFORM pgmq.delete(dlq_name, msg_id);

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.requeue_dlq_message(text, bigint) TO authenticated, service_role;

-- 5. read_dlq_messages: lets admins inspect DLQ contents
CREATE OR REPLACE FUNCTION public.read_dlq_messages(dlq_name text, limit_count integer DEFAULT 50)
RETURNS TABLE (msg_id bigint, enqueued_at timestamptz, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF dlq_name NOT IN ('auth_emails_dlq', 'transactional_emails_dlq') THEN
    RAISE EXCEPTION 'Invalid DLQ name: %', dlq_name;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT msg_id, enqueued_at, message FROM pgmq.q_%I ORDER BY enqueued_at DESC LIMIT $1',
    dlq_name
  ) USING limit_count;
EXCEPTION WHEN undefined_table THEN
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.read_dlq_messages(text, integer) TO authenticated, service_role;

-- 6. remove_email_suppression: admin-only suppression cleanup
CREATE OR REPLACE FUNCTION public.remove_email_suppression(email_addr text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.suppressed_emails WHERE email = email_addr;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_email_suppression(text) TO authenticated;

-- 7. updated_at trigger for config
CREATE TRIGGER trg_email_alert_config_updated
BEFORE UPDATE ON public.email_alert_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
