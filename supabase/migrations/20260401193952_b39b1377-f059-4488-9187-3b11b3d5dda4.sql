
CREATE OR REPLACE FUNCTION public.guardian_ward_count(_guardian_email text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.guardians
  WHERE guardian_email = _guardian_email
    AND status = 'accepted';
$$;
