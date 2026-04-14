
-- Count accepted guardian records by phone (for 3-ward limit enforcement)
CREATE OR REPLACE FUNCTION public.guardian_ward_count_by_phone(_phone text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.guardians
  WHERE guardian_phone = _phone
    AND status = 'accepted';
$$;

-- Check if a phone number has any guardian nomination (any status)
CREATE OR REPLACE FUNCTION public.check_guardian_nomination(_phone text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardians
    WHERE guardian_phone = _phone
  );
$$;
