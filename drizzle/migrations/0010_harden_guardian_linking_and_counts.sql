CREATE OR REPLACE FUNCTION public.guardian_ward_count(_guardian_email text)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN COUNT(*) >= 3 THEN 3 ELSE 0 END::integer
  FROM public.guardians
  WHERE _guardian_email IS NOT NULL AND guardian_email = _guardian_email AND status = 'accepted';
$$;

CREATE OR REPLACE FUNCTION public.guardian_ward_count_by_phone(_phone text)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN COUNT(*) >= 3 THEN 3 ELSE 0 END::integer
  FROM public.guardians
  WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g')
      = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
    AND status = 'accepted';
$$;

CREATE OR REPLACE FUNCTION public.link_guardian_user_id()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _email text; _phone_auth text; _phone_profile text; _row RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.bypass_guardian_trigger', 'true', true);

  SELECT au.email, au.phone INTO _email, _phone_auth FROM auth.users au WHERE au.id = auth.uid();
  SELECT p.phone INTO _phone_profile FROM profiles p WHERE p.id = auth.uid();

  -- Profile phone is user-editable: only trust it when that exact number was OTP-verified.
  IF _phone_profile IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.otp_events oe
    WHERE oe.verified = true
      AND right(regexp_replace(COALESCE(oe.phone,''), '\D', '', 'g'), 10)
        = right(regexp_replace(_phone_profile, '\D', '', 'g'), 10)
      AND length(regexp_replace(_phone_profile, '\D', '', 'g')) >= 10
  ) THEN
    _phone_profile := NULL;
  END IF;

  IF _email IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE guardian_email = _email AND guardian_user_id IS NULL;
  END IF;

  IF _phone_auth IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') = regexp_replace(_phone_auth, '\D', '', 'g')
      AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
      AND guardian_user_id IS NULL;
  END IF;

  IF _phone_profile IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') = regexp_replace(_phone_profile, '\D', '', 'g')
      AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
      AND guardian_user_id IS NULL;
  END IF;

  FOR _row IN
    UPDATE guardians SET install_confirmed_at = now()
    WHERE guardian_user_id = auth.uid() AND install_confirmed_at IS NULL
    RETURNING id, user_id, guardian_name
  LOOP
    PERFORM public.insert_notification_deduped(_row.user_id, 'Guardian App Installed',
      _row.guardian_name || ' has installed the Check-iN Guardian app and is now connected to you.',
      'guardian_installed', _row.id);
  END LOOP;

  PERFORM set_config('app.bypass_guardian_trigger', 'false', true);
END;
$function$;