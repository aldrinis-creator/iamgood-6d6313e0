
-- Fix 1: guardians_unrestricted_field_update
-- Enforce column-level restriction on UPDATE so wards cannot self-approve.
-- The existing trigger blocks this at row level; we now also revoke UPDATE
-- privilege on the sensitive columns so it is enforced by the grant system.
REVOKE UPDATE ON public.guardians FROM authenticated;
GRANT UPDATE (guardian_name, guardian_phone, guardian_email, relation, is_primary, is_vault_nominee)
  ON public.guardians TO authenticated;
-- service_role retains ALL from earlier grants.

-- Fix 2: vault_nominee_claims_guardian_read_no_status_check
-- Consolidate guardian-facing policies via a SECURITY DEFINER helper so every
-- guardian flow enforces the same strict gate: guardian is accepted AND is a
-- vault nominee AND is linked to the claim's guardian_id + user_id.
CREATE OR REPLACE FUNCTION public.is_accepted_vault_nominee(_guardian_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = _guardian_id
      AND g.user_id = _user_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
      AND g.is_vault_nominee = true
  );
$$;

DROP POLICY IF EXISTS "Guardians insert as nominee" ON public.vault_nominee_claims;
DROP POLICY IF EXISTS "Vault nominee guardian creates claim" ON public.vault_nominee_claims;
DROP POLICY IF EXISTS "Vault nominee guardian views own claims" ON public.vault_nominee_claims;
DROP POLICY IF EXISTS "Vault nominee guardian updates own claim docs" ON public.vault_nominee_claims;

CREATE POLICY "Vault nominee guardian creates claim"
  ON public.vault_nominee_claims FOR INSERT TO authenticated
  WITH CHECK (public.is_accepted_vault_nominee(guardian_id, user_id));

CREATE POLICY "Vault nominee guardian views own claims"
  ON public.vault_nominee_claims FOR SELECT TO authenticated
  USING (public.is_accepted_vault_nominee(guardian_id, user_id));

CREATE POLICY "Vault nominee guardian updates own claim docs"
  ON public.vault_nominee_claims FOR UPDATE TO authenticated
  USING (public.is_accepted_vault_nominee(guardian_id, user_id))
  WITH CHECK (public.is_accepted_vault_nominee(guardian_id, user_id));
