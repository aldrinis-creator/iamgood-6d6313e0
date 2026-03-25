
-- 1. Add guardian_user_id column to guardians table
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS guardian_user_id uuid;

-- 2. Fix handle_new_user() trigger to read role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role;
BEGIN
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'app_role')::public.app_role,
    'user'::public.app_role
  );
  
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), _role);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
  RETURN NEW;
END;
$function$;

-- 3. Add RLS policy for guardians to view their own guardian records via guardian_user_id
CREATE POLICY "Guardians can view records where they are guardian"
ON public.guardians
FOR SELECT
TO authenticated
USING (guardian_user_id = auth.uid());

-- 4. Update notifications RLS to support guardian_user_id
DROP POLICY IF EXISTS "Guardians can view their notifications" ON public.notifications;
CREATE POLICY "Guardians can view their notifications" ON public.notifications
FOR SELECT TO authenticated
USING (
  guardian_id IN (
    SELECT g.id FROM guardians g 
    WHERE g.guardian_user_id = auth.uid()
    OR g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Guardians can update their notifications" ON public.notifications;
CREATE POLICY "Guardians can update their notifications" ON public.notifications
FOR UPDATE TO authenticated
USING (
  guardian_id IN (
    SELECT g.id FROM guardians g 
    WHERE g.guardian_user_id = auth.uid()
    OR g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
  )
);

-- 5. Add function to auto-link guardian_user_id when a guardian logs in
CREATE OR REPLACE FUNCTION public.link_guardian_user_id()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
END;
$function$;
