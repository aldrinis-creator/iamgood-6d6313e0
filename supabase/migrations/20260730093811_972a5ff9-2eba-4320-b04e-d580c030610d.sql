-- Remove all write privileges from anonymous (not signed-in) visitors on guardians
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.guardians FROM anon;
REVOKE SELECT ON public.guardians FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.guardians FROM authenticated;

-- Defense in depth: ward's own-row update policy cannot flip security-sensitive fields
DROP POLICY IF EXISTS "Users can update their own guardians" ON public.guardians;
CREATE POLICY "Users can update their own guardians"
ON public.guardians
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status <> 'accepted')
WITH CHECK (auth.uid() = user_id);

-- Vault nominee claims: explicit accepted-status enforcement on every guardian read path
DROP POLICY IF EXISTS "Vault nominee guardian views own claims" ON public.vault_nominee_claims;
CREATE POLICY "Vault nominee guardian views own claims"
ON public.vault_nominee_claims
FOR SELECT
TO authenticated
USING (
  public.is_accepted_vault_nominee(guardian_id, user_id)
  AND EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = vault_nominee_claims.guardian_id
      AND g.user_id = vault_nominee_claims.user_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
      AND g.is_vault_nominee = true
  )
);

REVOKE ALL ON public.vault_nominee_claims FROM anon;