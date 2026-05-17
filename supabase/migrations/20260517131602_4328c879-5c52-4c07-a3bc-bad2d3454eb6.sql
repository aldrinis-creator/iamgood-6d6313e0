CREATE OR REPLACE FUNCTION public.purge_dlq(dlq_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE
  deleted_count bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF dlq_name NOT IN ('auth_emails_dlq', 'transactional_emails_dlq') THEN
    RAISE EXCEPTION 'Invalid DLQ name: %', dlq_name;
  END IF;

  BEGIN
    SELECT pgmq.purge_queue(dlq_name) INTO deleted_count;
    RETURN COALESCE(deleted_count, 0);
  EXCEPTION WHEN undefined_function THEN
    EXECUTE format('TRUNCATE pgmq.q_%I', dlq_name);
    RETURN 0;
  END;
EXCEPTION WHEN undefined_table THEN
  RETURN 0;
END;
$function$;