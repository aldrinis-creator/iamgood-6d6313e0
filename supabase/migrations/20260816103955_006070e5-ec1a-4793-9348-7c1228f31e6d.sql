-- 1) Waitlist: no impersonation of other users
DROP POLICY IF EXISTS "Allow public insert to waitlist" ON public.premium_plus_waitlist;
DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.premium_plus_waitlist;

CREATE POLICY "Waitlist self or anonymous insert"
ON public.premium_plus_waitlist
FOR INSERT
TO anon, authenticated
WITH CHECK (
  user_id IS NULL
  OR user_id = auth.uid()
);

-- 2) Notifications: a user may only attach a guardian_id that is their own guardian row
DROP POLICY IF EXISTS "Users can insert notifications for their guardians" ON public.notifications;

CREATE POLICY "Users can insert notifications for their guardians"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    guardian_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = notifications.guardian_id
        AND g.user_id = auth.uid()
    )
  )
);

-- 3) Vault claims: ownership columns are immutable for everyone (including admins)
CREATE OR REPLACE FUNCTION public.prevent_vault_claim_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id on a vault claim cannot be changed';
  END IF;
  IF NEW.guardian_id IS DISTINCT FROM OLD.guardian_id THEN
    RAISE EXCEPTION 'guardian_id on a vault claim cannot be changed';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_vault_claim_no_reassign ON public.vault_nominee_claims;
CREATE TRIGGER trg_vault_claim_no_reassign
BEFORE UPDATE ON public.vault_nominee_claims
FOR EACH ROW EXECUTE FUNCTION public.prevent_vault_claim_reassignment();
