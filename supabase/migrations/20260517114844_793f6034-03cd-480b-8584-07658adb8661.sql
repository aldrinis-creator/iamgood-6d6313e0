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

  EXECUTE format('DELETE FROM pgmq.q_%I', dlq_name);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
EXCEPTION WHEN undefined_table THEN
  RETURN 0;
END;
$function$;