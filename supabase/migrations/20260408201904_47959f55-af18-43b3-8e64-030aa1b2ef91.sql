
-- 1. Fix emergency_share_tokens anon policy: require caller to know the token
DROP POLICY IF EXISTS "Anyone can read active tokens" ON public.emergency_share_tokens;

CREATE POLICY "Anon can read token by value"
  ON public.emergency_share_tokens
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND token = current_setting('request.url', true)::text
  );

-- Actually the above won't work with Supabase client queries that use .eq().
-- The PostgREST filter already constrains the rows, but the policy itself
-- must not allow full table scans. We need a function approach instead.

-- Drop the policy we just created
DROP POLICY IF EXISTS "Anon can read token by value" ON public.emergency_share_tokens;

-- Create a security definer function to look up a token safely
CREATE OR REPLACE FUNCTION public.lookup_emergency_token(_token text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT est.user_id
  FROM public.emergency_share_tokens est
  WHERE est.token = _token
    AND est.is_active = true
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.lookup_emergency_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_emergency_token(text) TO authenticated;

-- Now remove anon SELECT entirely from emergency_share_tokens
-- (authenticated users still have their own policy)
-- No anon policy remains = anon cannot enumerate tokens

-- 2. Fix guardians anon policy: create a safe view excluding sensitive columns
CREATE OR REPLACE VIEW public.guardians_emergency_safe AS
SELECT
  g.user_id,
  g.guardian_name,
  g.relation,
  g.is_primary
FROM public.guardians g;

-- Grant anon select on the view
GRANT SELECT ON public.guardians_emergency_safe TO anon;
GRANT SELECT ON public.guardians_emergency_safe TO authenticated;

-- Drop the overly permissive anon policy on guardians
DROP POLICY IF EXISTS "Anon can read guardians with active share token" ON public.guardians;

-- 3. Fix function search paths
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;
