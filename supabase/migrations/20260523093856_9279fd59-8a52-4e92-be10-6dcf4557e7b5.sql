
-- 1) Lock down sensitive columns on guardians via trigger
CREATE OR REPLACE FUNCTION public.prevent_guardian_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role to update anything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block changes to security-sensitive fields by the ward
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
$$;

DROP TRIGGER IF EXISTS trg_prevent_guardian_self_approval ON public.guardians;
CREATE TRIGGER trg_prevent_guardian_self_approval
BEFORE UPDATE ON public.guardians
FOR EACH ROW
EXECUTE FUNCTION public.prevent_guardian_self_approval();

-- 2) Vault nominee claims: require accepted guardian status for read & update
DROP POLICY IF EXISTS "Guardians read own claim" ON public.vault_nominee_claims;
CREATE POLICY "Guardians read own claim"
ON public.vault_nominee_claims
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = vault_nominee_claims.guardian_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
  )
);

DROP POLICY IF EXISTS "Guardians update own claim docs" ON public.vault_nominee_claims;
CREATE POLICY "Guardians update own claim docs"
ON public.vault_nominee_claims
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = vault_nominee_claims.guardian_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = vault_nominee_claims.guardian_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
  )
);
