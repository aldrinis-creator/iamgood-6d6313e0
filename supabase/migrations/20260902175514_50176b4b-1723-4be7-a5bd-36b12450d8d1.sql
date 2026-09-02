CREATE OR REPLACE FUNCTION public.prevent_guardian_self_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role to update anything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow trusted system functions that explicitly opt in (transaction-local)
  IF coalesce(current_setting('app.bypass_guardian_trigger', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'status can only be changed via the guardian acceptance flow';
  END IF;
  IF NEW.guardian_user_id IS DISTINCT FROM OLD.guardian_user_id THEN
    RAISE EXCEPTION 'guardian_user_id is managed by the system';
  END IF;
  IF NEW.nomination_token IS DISTINCT FROM OLD.nomination_token THEN
    RAISE EXCEPTION 'nomination_token cannot be modified';
  END IF;
  IF NEW.nomination_expires_at IS DISTINCT FROM OLD.nomination_expires_at THEN
    RAISE EXCEPTION 'nomination_expires_at cannot be modified';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be modified';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_guardian_user_id()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _phone_auth text;
  _phone_profile text;
  _row RECORD;
BEGIN
  -- Trusted system linking: opt out of the anti-tampering trigger for this txn
  PERFORM set_config('app.bypass_guardian_trigger', 'true', true);

  SELECT au.email INTO _email FROM auth.users au WHERE au.id = auth.uid();
  SELECT au.phone INTO _phone_auth FROM auth.users au WHERE au.id = auth.uid();
  SELECT p.phone INTO _phone_profile FROM profiles p WHERE p.id = auth.uid();

  IF _email IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE guardian_email = _email AND guardian_user_id IS NULL;
  END IF;

  IF _phone_auth IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g')
        = regexp_replace(_phone_auth, '\D', '', 'g')
      AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
      AND guardian_user_id IS NULL;
  END IF;

  IF _phone_profile IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g')
        = regexp_replace(_phone_profile, '\D', '', 'g')
      AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
      AND guardian_user_id IS NULL;
  END IF;

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

  PERFORM set_config('app.bypass_guardian_trigger', 'false', true);
END;
$function$;