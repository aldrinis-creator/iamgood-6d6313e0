
-- 1. Change default nomination_expires_at from 24h to 72h
ALTER TABLE public.guardians 
  ALTER COLUMN nomination_expires_at SET DEFAULT (now() + interval '72 hours');

-- 2. Remove auto-accept from link_guardian_user_id — only link user_id, no status change
CREATE OR REPLACE FUNCTION public.link_guardian_user_id()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _email text;
  _phone text;
BEGIN
  SELECT au.email INTO _email FROM auth.users au WHERE au.id = auth.uid();
  SELECT p.phone INTO _phone FROM profiles p WHERE p.id = auth.uid();
  
  IF _email IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE guardian_email = _email AND guardian_user_id IS NULL;
  END IF;
  
  IF _phone IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE guardian_phone = _phone AND guardian_user_id IS NULL;
  END IF;
  
  -- No auto-accept: guardians must explicitly accept via the invite link
END;
$$;

-- 3. Create function to expire stale nominations and notify wards
CREATE OR REPLACE FUNCTION public.expire_stale_nominations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_row RECORD;
  expired_count integer := 0;
BEGIN
  FOR expired_row IN
    UPDATE public.guardians
    SET status = 'expired'
    WHERE status = 'pending'
      AND nomination_expires_at < now()
    RETURNING id, user_id, guardian_name
  LOOP
    -- Notify the ward
    PERFORM public.insert_notification_deduped(
      expired_row.user_id,
      'Guardian Nomination Expired',
      expired_row.guardian_name || ' did not respond to your guardian nomination. You can re-send the invite from Settings.',
      'nomination_expired',
      expired_row.id
    );
    expired_count := expired_count + 1;
  END LOOP;
  
  RETURN expired_count;
END;
$$;

-- 4. Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
