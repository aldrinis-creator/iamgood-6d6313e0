-- Fix 1: Prevent ward from self-approving guardian rows by attaching the existing guard trigger
DROP TRIGGER IF EXISTS prevent_guardian_self_approval_trg ON public.guardians;
CREATE TRIGGER prevent_guardian_self_approval_trg
  BEFORE UPDATE ON public.guardians
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_guardian_self_approval();

-- Fix 2: Restrict vault_nominee_claims UPDATE to vault-nominee guardians only
DROP POLICY IF EXISTS "Guardians update own claim docs" ON public.vault_nominee_claims;
CREATE POLICY "Guardians update own claim docs"
ON public.vault_nominee_claims
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.guardians g
  WHERE g.id = vault_nominee_claims.guardian_id
    AND g.guardian_user_id = auth.uid()
    AND g.status = 'accepted'
    AND g.is_vault_nominee = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.guardians g
  WHERE g.id = vault_nominee_claims.guardian_id
    AND g.guardian_user_id = auth.uid()
    AND g.status = 'accepted'
    AND g.is_vault_nominee = true
));