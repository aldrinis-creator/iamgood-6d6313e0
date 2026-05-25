
-- Fix 1: Attach the prevent_guardian_self_approval trigger to block wards from
-- self-approving or modifying security-sensitive fields on guardians rows.
DROP TRIGGER IF EXISTS prevent_guardian_self_approval_trg ON public.guardians;
CREATE TRIGGER prevent_guardian_self_approval_trg
BEFORE UPDATE ON public.guardians
FOR EACH ROW
EXECUTE FUNCTION public.prevent_guardian_self_approval();

-- Fix 2: Restrict vault_nominee_claims SELECT for guardians to nominees only.
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
      AND g.is_vault_nominee = true
  )
);
