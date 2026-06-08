
-- 1) Attach the existing guard trigger so wards cannot self-approve guardians
DROP TRIGGER IF EXISTS prevent_guardian_self_approval_trg ON public.guardians;
CREATE TRIGGER prevent_guardian_self_approval_trg
  BEFORE UPDATE ON public.guardians
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_guardian_self_approval();

-- 2) Drop duplicate policies on vault_nominee_claims (keep the more descriptive ones)
DROP POLICY IF EXISTS "Guardians read own claim" ON public.vault_nominee_claims;
DROP POLICY IF EXISTS "Guardians update own claim docs" ON public.vault_nominee_claims;
