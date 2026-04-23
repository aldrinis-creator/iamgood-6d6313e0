-- 1. Categorise encrypted_documents
ALTER TABLE public.encrypted_documents
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'identity',
  ADD COLUMN IF NOT EXISTS label text;

CREATE INDEX IF NOT EXISTS idx_encrypted_documents_user_category
  ON public.encrypted_documents(user_id, category);

-- 2. Shadow metadata for reminder scheduling (unencrypted, minimal labels only)
CREATE TABLE IF NOT EXISTS public.vault_reminder_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_id uuid NOT NULL REFERENCES public.encrypted_documents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('insurance_renewal','insurance_expiry','will_review')),
  display_label text NOT NULL,
  next_reminder_at timestamptz NOT NULL,
  tier text NOT NULL DEFAULT '7d' CHECK (tier IN ('7d','3d','24h','due','done','quarterly')),
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_reminder_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminder meta"
  ON public.vault_reminder_meta
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages reminder meta"
  ON public.vault_reminder_meta
  FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_vault_reminder_meta_next
  ON public.vault_reminder_meta(next_reminder_at) WHERE tier <> 'done';

-- 3. PIN escrow (Shamir shares)
CREATE TABLE IF NOT EXISTS public.vault_pin_escrow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  guardian_id uuid REFERENCES public.guardians(id) ON DELETE SET NULL,
  admin_share_encrypted text NOT NULL,
  guardian_share_encrypted text NOT NULL,
  recovery_share_hint text,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_pin_escrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pin escrow"
  ON public.vault_pin_escrow
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages pin escrow"
  ON public.vault_pin_escrow
  FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 4. Nominee death-claim lifecycle
CREATE TABLE IF NOT EXISTS public.vault_nominee_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  guardian_id uuid NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','docs_uploaded','user_window_open','released','rejected','cancelled')),
  death_certificate_url text,
  id_proof_url text,
  proof_uploaded_at timestamptz,
  user_window_started_at timestamptz,
  user_window_ends_at timestamptz,
  released_at timestamptz,
  rejected_at timestamptz,
  reject_reason text,
  admin_reviewed_by uuid,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_nominee_claims ENABLE ROW LEVEL SECURITY;

-- Validation trigger: window end must be exactly 7 days after start
CREATE OR REPLACE FUNCTION public.enforce_vault_claim_window()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_window_started_at IS NOT NULL THEN
    NEW.user_window_ends_at := NEW.user_window_started_at + interval '7 days';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vault_claim_window ON public.vault_nominee_claims;
CREATE TRIGGER trg_vault_claim_window
  BEFORE INSERT OR UPDATE ON public.vault_nominee_claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vault_claim_window();

CREATE POLICY "Deceased user views own claim"
  ON public.vault_nominee_claims
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Deceased user cancels own claim"
  ON public.vault_nominee_claims
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vault nominee guardian views own claims"
  ON public.vault_nominee_claims
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = vault_nominee_claims.guardian_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
      AND g.is_vault_nominee = true
  ));

CREATE POLICY "Vault nominee guardian creates claim"
  ON public.vault_nominee_claims
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = vault_nominee_claims.guardian_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
      AND g.is_vault_nominee = true
      AND g.user_id = vault_nominee_claims.user_id
  ));

CREATE POLICY "Vault nominee guardian updates own claim docs"
  ON public.vault_nominee_claims
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = vault_nominee_claims.guardian_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
      AND g.is_vault_nominee = true
  ));

CREATE POLICY "Admins view all claims"
  ON public.vault_nominee_claims
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update claims"
  ON public.vault_nominee_claims
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role manages claims"
  ON public.vault_nominee_claims
  FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_vault_nominee_claims_user ON public.vault_nominee_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_nominee_claims_status ON public.vault_nominee_claims(status);

-- 5. One vault nominee per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vault_nominee_per_user
  ON public.guardians(user_id) WHERE is_vault_nominee = true;

-- 6. Release tokens for nominee claim portal
CREATE TABLE IF NOT EXISTS public.vault_release_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.vault_nominee_claims(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  guardian_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  otp_hash text,
  otp_attempts integer NOT NULL DEFAULT 0,
  payload_encrypted text,
  payload_iv text,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_release_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages release tokens"
  ON public.vault_release_tokens
  FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins view release tokens"
  ON public.vault_release_tokens
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_vault_release_tokens_token ON public.vault_release_tokens(token);

-- 7. updated_at triggers on new tables
DROP TRIGGER IF EXISTS trg_vault_reminder_meta_updated ON public.vault_reminder_meta;
CREATE TRIGGER trg_vault_reminder_meta_updated
  BEFORE UPDATE ON public.vault_reminder_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vault_pin_escrow_updated ON public.vault_pin_escrow;
CREATE TRIGGER trg_vault_pin_escrow_updated
  BEFORE UPDATE ON public.vault_pin_escrow
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();