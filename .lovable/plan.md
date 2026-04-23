

## Plan — Robust death-verification for VaultClaimCard

The current `VaultClaimCard` already collects two documents and a perjury checkbox, but the verification chain has gaps: identity-binding, file integrity, status-transition tampering, and admin re-checks aren't enforced. This plan hardens each layer end-to-end.

### A. Frontend hardening (`src/components/vault/VaultClaimCard.tsx`)

Expand from 3 steps to **5 steps** with progressive gating; cannot skip ahead:

1. **Eligibility self-check** — display the user's name, the date the guardian was nominated, and a one-line reminder that filing falsely is a criminal offence under IPC §191/§193. "Continue" disabled for 5 seconds (anti-impulse).
2. **Death certificate** — required PDF/JPG/PNG, ≤10 MB, ≥50 KB (rejects empty placeholders). Capture `issuing_authority`, `certificate_number`, `date_of_death` (must be ≤ today and ≥ user's DOB) as structured fields alongside the file.
3. **Nominee government ID** — required upload + `id_type` (Aadhaar/Passport/DL/Voter), `id_number_last4`. Server checks the last-4 against `profiles.phone`'s linked KYC if present (best-effort).
4. **Selfie + liveness** — new step: nominee takes a live selfie via `getUserMedia` (front camera) holding the uploaded ID. Stored in `medical-documents` under `claims/<id>/selfie.jpg`. Blocks file-picker bypass.
5. **Sworn declaration** — three separate checkboxes (not one), each with distinct text:
   a. "I confirm <ward> has died on <date_of_death>."
   b. "I confirm I am the nominated person and have uploaded my own ID."
   c. "I understand a false claim is a criminal offence and may be referred to the police."
   Plus typed full name matching the guardian record (case-insensitive, trimmed) and a re-prompt for the guardian's account password (re-auth via `supabase.auth.signInWithPassword`) before submit.

Client validations (Zod):
- File size 50 KB–10 MB; MIME in `["application/pdf","image/jpeg","image/png"]`.
- `date_of_death` parseable and within `[user.date_of_birth, today]`.
- `id_number_last4` exactly 4 digits.
- Typed name === `guardians.guardian_name` (trim/case-insensitive).
- Re-auth must succeed within last 60 s before insert.

Submit flow now: insert claim row with `status='initiated'` → upload all 3 files → patch row to `status='docs_uploaded'` with structured metadata → invoke `vault-claim-initiated`. If any upload fails, the claim row is **deleted** (not left orphaned).

### B. Database (one migration)

```sql
ALTER TABLE public.vault_nominee_claims
  ADD COLUMN selfie_url text,
  ADD COLUMN issuing_authority text,
  ADD COLUMN certificate_number text,
  ADD COLUMN date_of_death date,
  ADD COLUMN id_type text,
  ADD COLUMN id_number_last4 text,
  ADD COLUMN nominee_typed_name text,
  ADD COLUMN reauth_at timestamptz,
  ADD COLUMN file_hashes jsonb;          -- {death_cert: sha256, id_proof: sha256, selfie: sha256}

-- Status-transition guard: enforce a strict state machine instead of free-text writes
CREATE OR REPLACE FUNCTION public.enforce_vault_claim_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed jsonb := '{
  "initiated":["docs_uploaded","cancelled"],
  "docs_uploaded":["user_window_open","cancelled","rejected"],
  "user_window_open":["released","rejected","cancelled"],
  "released":[],"rejected":[],"cancelled":[]
}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NOT (allowed->OLD.status ? NEW.status) THEN
      RAISE EXCEPTION 'Illegal vault claim transition % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vault_claim_status BEFORE UPDATE ON public.vault_nominee_claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vault_claim_status_transition();

-- Lock down RLS: guardians can INSERT only if they're the nominee, can SELECT their own,
-- and can UPDATE only status='cancelled' (admin/service-role does the rest).
DROP POLICY IF EXISTS "Guardians manage own claims" ON public.vault_nominee_claims;
CREATE POLICY "Guardians insert as nominee" ON public.vault_nominee_claims FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.guardians g
    WHERE g.id = guardian_id AND g.guardian_user_id = auth.uid()
    AND g.is_vault_nominee = true AND g.status = 'accepted'));
CREATE POLICY "Guardians read own claim" ON public.vault_nominee_claims FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guardians g
    WHERE g.id = guardian_id AND g.guardian_user_id = auth.uid()));
CREATE POLICY "Ward reads/cancels own claim" ON public.vault_nominee_claims FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- Partial unique: only one ACTIVE claim per ward at a time
CREATE UNIQUE INDEX IF NOT EXISTS vault_one_active_claim_per_user
  ON public.vault_nominee_claims (user_id)
  WHERE status IN ('initiated','docs_uploaded','user_window_open');

-- Rate limit: guardian cannot file more than 1 claim per 30 days against the same ward
CREATE OR REPLACE FUNCTION public.enforce_vault_claim_rate_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vault_nominee_claims
    WHERE guardian_id = NEW.guardian_id AND user_id = NEW.user_id
      AND created_at > now() - interval '30 days'
      AND status IN ('rejected','cancelled')) THEN
    RAISE EXCEPTION 'Cannot refile a claim within 30 days of a previous rejection/cancellation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vault_claim_rate BEFORE INSERT ON public.vault_nominee_claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vault_claim_rate_limit();
```

### C. Edge function `vault-claim-initiated` upgrade

After receiving `claim_id`:
1. Re-fetch the claim, verify all 3 storage paths exist via `storage.from(...).list()` and that file sizes match the recorded hashes (re-hash on download is too slow; instead just verify presence + non-zero size).
2. Cross-check: `claim.user_id`'s `auth.users.last_sign_in_at` — if the user signed in within last 24 h, **automatically reject** the claim (`status='rejected'`, reason "User active within 24h of claim — likely false report") and notify all parties. Strong tamper signal.
3. Cross-check: `profiles.date_of_birth` ≤ `claim.date_of_death`; reject if violated.
4. Notify deceased user across **3 channels** (in-app, email, SMS via msg91) — current code only does in-app + a contact_submission. Add email + SMS so a living user is reached even if they don't open the app.
5. Notify ALL other guardians (already there).
6. Set `status='user_window_open'` (currently the trigger ensures `user_window_ends_at` = +7d).
7. Log a row in `admin_audit_log` with `action='vault_claim_filed'` and the structured metadata.

### D. Admin review hardening (`src/pages/AdminVaultClaims.tsx`)

Show all new fields side-by-side: certificate number, issuing authority, date of death, ID type/last-4, typed name, selfie thumbnail next to ID thumbnail, and the **user's last login + last check-in + last journey** as activity signals. Admin must:
- Tick "Documents are legible and consistent" before Release button enables.
- Type "RELEASE" verbatim to confirm.
- Provide a non-empty `release_notes` (audit trail).

`vault-release-claim` already requires admin role; we also gate on `claim.status='user_window_open'` AND `now() >= user_window_ends_at` server-side (defense-in-depth; the trigger above already blocks bad transitions).

### E. Build-error fix (the immediate blocker)

The current build is failing because the bundle exceeds the PWA precache limit. Update `vite.config.ts` to raise `workbox.maximumFileSizeToCacheInBytes` to 5 MiB so the new vault code ships:

```ts
VitePWA({
  workbox: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, /* existing options */ },
  /* ... */
})
```

### F. What I will NOT change

- No change to `vault-release-claim`, `vault-claim-otp-verify`, `vault-cancel-claim` core flows (only the admin UI gates around them).
- No change to PIN escrow / Shamir logic.
- No change to `VaultClaimCancelBanner` (the user-side cancel path).
- No change to encryption library or storage bucket.

### Verification

1. Open Guardian Dashboard as a non-nominee → no claim card. As a nominee → 5-step wizard appears.
2. Try to skip step 4 (selfie) by uploading a normal photo file from disk → blocked (camera capture required).
3. Submit valid claim → claim row created with all metadata, 3 files in `claims/<id>/`, status `user_window_open`, `user_window_ends_at = now() + 7d`.
4. Log in as the deceased user within 24 h → next cron / next admin open shows the claim auto-rejected with the activity reason; user receives in-app + email + SMS within minutes of filing.
5. Try to refile a rejected claim within 30 days → blocked at DB level with clear toast.
6. Try `update vault_nominee_claims set status='released'` as guardian → blocked by RLS; try as user → blocked by transition trigger.
7. Admin panel: Release button stays disabled until checkbox + typed "RELEASE" + notes; release succeeds and OTP portal works as today.
8. Build now succeeds (PWA cache limit raised).

