
-- 1. Guardians: prevent ward from self-approving via status column via trigger
CREATE OR REPLACE FUNCTION public.prevent_ward_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allow only the invited guardian themselves, or service role, to change status
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF OLD.guardian_user_id IS NOT NULL AND auth.uid() = OLD.guardian_user_id THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only the invited guardian can change guardian status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guardians_prevent_ward_status_change ON public.guardians;
CREATE TRIGGER guardians_prevent_ward_status_change
  BEFORE UPDATE OF status ON public.guardians
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ward_status_change();

-- 2. Vault nominee claims: add explicit status='accepted' check in guardian policies
DROP POLICY IF EXISTS "Vault nominee guardian views own claims" ON public.vault_nominee_claims;
CREATE POLICY "Vault nominee guardian views own claims"
  ON public.vault_nominee_claims
  FOR SELECT
  USING (
    is_accepted_vault_nominee(guardian_id, user_id)
    AND EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = vault_nominee_claims.guardian_id
        AND g.user_id = vault_nominee_claims.user_id
        AND g.guardian_user_id = auth.uid()
        AND g.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Vault nominee guardian creates claim" ON public.vault_nominee_claims;
CREATE POLICY "Vault nominee guardian creates claim"
  ON public.vault_nominee_claims
  FOR INSERT
  WITH CHECK (
    is_accepted_vault_nominee(guardian_id, user_id)
    AND EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = vault_nominee_claims.guardian_id
        AND g.user_id = vault_nominee_claims.user_id
        AND g.guardian_user_id = auth.uid()
        AND g.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Vault nominee guardian updates own claim docs" ON public.vault_nominee_claims;
CREATE POLICY "Vault nominee guardian updates own claim docs"
  ON public.vault_nominee_claims
  FOR UPDATE
  USING (
    is_accepted_vault_nominee(guardian_id, user_id)
    AND EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = vault_nominee_claims.guardian_id
        AND g.user_id = vault_nominee_claims.user_id
        AND g.guardian_user_id = auth.uid()
        AND g.status = 'accepted'
    )
  )
  WITH CHECK (
    is_accepted_vault_nominee(guardian_id, user_id)
    AND EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = vault_nominee_claims.guardian_id
        AND g.user_id = vault_nominee_claims.user_id
        AND g.guardian_user_id = auth.uid()
        AND g.status = 'accepted'
    )
  );
