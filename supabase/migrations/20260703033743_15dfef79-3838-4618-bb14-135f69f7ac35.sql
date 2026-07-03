
-- Make phone lookups format-tolerant (compare digits only)
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT au.email
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')
      = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') <> ''
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.check_guardian_nomination(_phone text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardians
    WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g')
        = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
      AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
  );
$$;

CREATE OR REPLACE FUNCTION public.guardian_ward_count_by_phone(_phone text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.guardians
  WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g')
      = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
    AND status = 'accepted';
$$;

CREATE OR REPLACE FUNCTION public.link_guardian_user_id()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
    WHERE regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g')
        = regexp_replace(_phone, '\D', '', 'g')
      AND regexp_replace(COALESCE(guardian_phone, ''), '\D', '', 'g') <> ''
      AND guardian_user_id IS NULL;
  END IF;
END;
$$;
