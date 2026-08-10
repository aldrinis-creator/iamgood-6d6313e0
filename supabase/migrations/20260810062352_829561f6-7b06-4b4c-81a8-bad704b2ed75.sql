REVOKE UPDATE ON public.guardians FROM authenticated;
GRANT UPDATE (guardian_name, guardian_phone, guardian_email, relation, is_primary, is_vault_nominee)
  ON public.guardians TO authenticated;
GRANT ALL ON public.guardians TO service_role;