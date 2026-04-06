CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _role public.app_role;
BEGIN
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'app_role')::public.app_role,
    'user'::public.app_role
  );
  
  INSERT INTO public.profiles (id, full_name, role, phone, date_of_birth)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _role,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::date
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.guardians (
    user_id,
    guardian_name,
    guardian_phone,
    guardian_email,
    relation,
    is_primary,
    status
  )
  SELECT
    NEW.id,
    btrim(g.guardian_name),
    btrim(g.guardian_phone),
    NULLIF(btrim(g.guardian_email), ''),
    NULLIF(btrim(g.relation), ''),
    COALESCE(g.is_primary, false),
    'pending'
  FROM jsonb_to_recordset(COALESCE(NEW.raw_user_meta_data->'guardians', '[]'::jsonb)) AS g(
    guardian_name text,
    guardian_phone text,
    guardian_email text,
    relation text,
    is_primary boolean
  )
  WHERE NULLIF(btrim(g.guardian_name), '') IS NOT NULL
    AND NULLIF(btrim(g.guardian_phone), '') IS NOT NULL;
  
  RETURN NEW;
END;
$$;