
ALTER TABLE public.vault_nominee_claims
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS issuing_authority text,
  ADD COLUMN IF NOT EXISTS certificate_number text,
  ADD COLUMN IF NOT EXISTS date_of_death date,
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS id_number_last4 text,
  ADD COLUMN IF NOT EXISTS nominee_typed_name text,
  ADD COLUMN IF NOT EXISTS reauth_at timestamptz,
  ADD COLUMN IF NOT EXISTS file_hashes jsonb;

CREATE OR REPLACE FUNCTION public.enforce_vault_claim_status_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE allowed jsonb := '{
  "initiated":["docs_uploaded","cancelled"],
  "docs_uploaded":["user_window_open","cancelled","rejected"],
  "user_window_open":["released","rejected","cancelled"],
  "released":[],"rejected":[],"cancelled":[]
}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (allowed ? OLD.status) OR NOT (allowed->OLD.status ? NEW.status) THEN
      RAISE EXCEPTION 'Illegal vault claim transition % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vault_claim_status ON public.vault_nominee_claims;
CREATE TRIGGER trg_vault_claim_status BEFORE UPDATE ON public.vault_nominee_claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vault_claim_status_transition();

DROP POLICY IF EXISTS "Guardians manage own claims" ON public.vault_nominee_claims;
DROP POLICY IF EXISTS "Guardians insert as nominee" ON public.vault_nominee_claims;
DROP POLICY IF EXISTS "Guardians read own claim" ON public.vault_nominee_claims;
DROP POLICY IF EXISTS "Ward reads/cancels own claim" ON public.vault_nominee_claims;

CREATE POLICY "Guardians insert as nominee" ON public.vault_nominee_claims
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.guardians g
    WHERE g.id = guardian_id AND g.guardian_user_id = auth.uid()
      AND g.is_vault_nominee = true AND g.status = 'accepted'));

CREATE POLICY "Guardians read own claim" ON public.vault_nominee_claims
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guardians g
    WHERE g.id = guardian_id AND g.guardian_user_id = auth.uid()));

CREATE POLICY "Guardians update own claim docs" ON public.vault_nominee_claims
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guardians g
    WHERE g.id = guardian_id AND g.guardian_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.guardians g
    WHERE g.id = guardian_id AND g.guardian_user_id = auth.uid()));

CREATE POLICY "Ward reads own claim" ON public.vault_nominee_claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Ward cancels own claim" ON public.vault_nominee_claims
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

CREATE UNIQUE INDEX IF NOT EXISTS vault_one_active_claim_per_user
  ON public.vault_nominee_claims (user_id)
  WHERE status IN ('initiated','docs_uploaded','user_window_open');

CREATE OR REPLACE FUNCTION public.enforce_vault_claim_rate_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vault_nominee_claims
    WHERE guardian_id = NEW.guardian_id AND user_id = NEW.user_id
      AND created_at > now() - interval '30 days'
      AND status IN ('rejected','cancelled')) THEN
    RAISE EXCEPTION 'Cannot refile a claim within 30 days of a previous rejection/cancellation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vault_claim_rate ON public.vault_nominee_claims;
CREATE TRIGGER trg_vault_claim_rate BEFORE INSERT ON public.vault_nominee_claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vault_claim_rate_limit();
