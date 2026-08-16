ALTER TABLE public.guardians
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ward_notified_unaccepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS install_confirmed_at timestamp with time zone;

ALTER TABLE public.guardians
  ALTER COLUMN nomination_expires_at SET DEFAULT (now() + interval '4 days');

CREATE OR REPLACE FUNCTION public.link_guardian_user_id()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _phone text;
  _row RECORD;
BEGIN
  SELECT au.email INTO _email FROM auth.users au WHERE au.id = auth.uid();
  SELECT p.phone INTO _phone FROM profiles p WHERE p.id = auth.uid();

  IF _email IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE guardian_email = _email AND guardian_user_id IS NULL;
  END IF;

  IF _phone IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g')
        = regexp_replace(_phone, '\D', '', 'g')
      AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
      AND guardian_user_id IS NULL;
  END IF;

  -- Confirm to each ward that their guardian has installed / opened the app
  FOR _row IN
    UPDATE guardians
    SET install_confirmed_at = now()
    WHERE guardian_user_id = auth.uid()
      AND install_confirmed_at IS NULL
    RETURNING id, user_id, guardian_name
  LOOP
    PERFORM public.insert_notification_deduped(
      _row.user_id,
      'Guardian App Installed',
      _row.guardian_name || ' has installed the Check-iN Guardian app and is now connected to you.',
      'guardian_installed',
      _row.id
    );
  END LOOP;
END;
$function$;