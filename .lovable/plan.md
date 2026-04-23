

## Plan — Vault expansion: Emails, Banks, Insurance, Legal Will & Death-Nominee Workflow

A major Vault expansion adding 4 new categorised secret stores (all PIN-protected, AES-256-GCM encrypted, zero-knowledge), plus a new **Nominee** lifecycle that lets a designated Guardian claim Vault contents after the user's verified death.

---

### A. New Vault sub-tabs (inside the existing **Vault** tab on `MedicalVault.tsx`)

Replace the single flat list of encrypted docs with a **5-section accordion** under the existing PIN gate. All sections are encrypted with the same vault PIN; a `category` column on `encrypted_documents` separates them.

1. **Identity Docs** (existing — Aadhaar, PAN, Passport, DL).
2. **Email Accounts** — list of `{ label, email, password, recovery_email?, notes? }` JSON entries (whole record encrypted as one blob per entry). Add / Edit / Delete / Show-Hide-Password buttons.
3. **Bank Accounts** — `{ bank_name, account_number, ifsc, account_type, nominee_name, nominee_relation, nominee_phone, branch?, notes? }`.
4. **Insurance** — `{ category: "life"|"health"|"general", company, policy_number, sum_assured, nominee_name, nominee_relation, nominee_phone, premium_amount, premium_frequency, start_date, renewal_date, expiry_date, notes? }`.
   - **Reminders**: client-side scheduler reads all Insurance entries at app start and computes next reminder dates → 7 days / 3 days / 24 hours before `renewal_date` and `expiry_date`. Reminders are persisted in the existing `notifications` table via `insert_notification_deduped` RPC (no plaintext leaked — only "Health Insurance with HDFC Ergo expires in 7 days, renew now"). A new edge function `vault-reminder-scan` runs daily via pg_cron and reads a small unencrypted shadow row (see §C) to drive notifications without needing the PIN.
5. **Legal Will** — `{ status: "none"|"draft"|"completed", partner_will_id?, partner: "willjini"|"ezeewill"|"other", created_on, last_reviewed, document_ref, nominee_name, nominee_phone, notes? }`.
   - **Quarterly review reminder**: same scheduler creates a notification every 90 days from `last_reviewed`: *"Review your Will — confirm if any changes needed."* Tapping opens the Will entry to edit.
   - **Partner integration stub**: a "Create / Update Will via Partner" button hits a new edge function `legal-will-partner` that currently returns a placeholder URL (e.g. `https://willjini.com/start?ref=<userId>`); the function shape is built so a real partner API key + payload can be plugged in later via Lovable Cloud secret.

UI: each section uses a compact card list + an inline "Add" dialog. Reuse existing `encrypt()` / `decrypt()` from `src/lib/encryption.ts`.

---

### B. Database — schema changes (one migration)

```sql
-- 1. Categorise encrypted_documents (keep existing rows valid)
ALTER TABLE public.encrypted_documents
  ADD COLUMN category text NOT NULL DEFAULT 'identity',
  ADD COLUMN label text;
-- existing rows auto-fall under "identity"

-- 2. Shadow metadata (unencrypted, minimal) for reminder scheduling
CREATE TABLE public.vault_reminder_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_id uuid NOT NULL REFERENCES public.encrypted_documents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('insurance_renewal','insurance_expiry','will_review')),
  display_label text NOT NULL,         -- e.g. "Health Insurance · HDFC Ergo"
  next_reminder_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_reminder_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reminder meta" ON public.vault_reminder_meta
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Death-claim lifecycle
CREATE TABLE public.vault_nominee_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,                    -- the deceased
  guardian_id uuid NOT NULL REFERENCES public.guardians(id),
  status text NOT NULL DEFAULT 'initiated'  -- initiated → docs_uploaded → user_window_open → released | rejected | cancelled
    CHECK (status IN ('initiated','docs_uploaded','user_window_open','released','rejected','cancelled')),
  death_certificate_url text,               -- storage path in 'medical-documents' bucket (private)
  id_proof_url text,                        -- nominee's ID proof
  proof_uploaded_at timestamptz,
  user_window_started_at timestamptz,       -- 7-day grace window start
  user_window_ends_at timestamptz,          -- + 7 days
  released_at timestamptz,
  rejected_at timestamptz,
  reject_reason text,
  admin_reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_nominee_claims ENABLE ROW LEVEL SECURITY;
-- Policies: deceased user can SELECT their own claim (to cancel during grace);
-- nominating guardian (guardians.guardian_user_id = auth.uid() && is_vault_nominee = true) can SELECT/INSERT;
-- service_role manages all (admin review + release).

-- 4. Mark a guardian as "Vault Nominee" — column already exists (is_vault_nominee boolean default false). Reuse it.
```

Validation triggers (not CHECK constraints) ensure `user_window_ends_at = user_window_started_at + interval '7 days'`.

---

### C. Death-Nominee Claim Workflow

**Pre-conditions (set up by the user, while alive):**
- In Settings → Guardians, a new toggle **"Vault Nominee"** sets `guardians.is_vault_nominee = true` for one guardian (max 1 enforced via partial unique index per `user_id`). This guardian is shown the option to claim Vault contents post-death.
- The nominated guardian must be in `status = 'accepted'`.

**Stage 1 — Initiate (Guardian side, in their Guardian Dashboard):**
- New card "Vault Nominee Access" appears only if `is_vault_nominee = true` for the selected ward.
- Tapping "Report Bereavement & Claim Vault" opens a multi-step dialog:
  1. **Upload Death Certificate** (PDF/image, ≤10 MB) → stored in `medical-documents` bucket under `claims/<claim_id>/death_certificate.<ext>`.
  2. **Upload Nominee's Government ID Proof** (Aadhaar/Passport/DL) → same bucket.
  3. Confirm legal acknowledgement checkbox: *"I declare under penalty of perjury that the user has passed away and I am the lawful nominee."*
- Inserts `vault_nominee_claims` with `status='docs_uploaded'`. Triggers an edge function `vault-claim-initiated` that:
  - Sends an email + WhatsApp + push to the **deceased user's last known phone/email** ("Vault claim initiated. If you receive this, log in within 7 days to cancel.").
  - Sends a copy to ALL the user's other guardians for cross-verification.
  - Notifies admin via `contact_submissions` row with subject "Vault claim review needed".

**Stage 2 — Living-User Grace Window (7 days):**
- `vault_claim-initiated` sets `status='user_window_open'`, `user_window_started_at=now()`, `user_window_ends_at=now()+7d`.
- During this window, the user (if alive) sees a **full-screen blocking banner** on every login: *"A Vault claim has been filed by <Guardian>. If this is incorrect, tap CANCEL CLAIM to stop release."* → calls `vault-cancel-claim` edge function which sets `status='cancelled'`. Cancellation also forces a password reset for security.
- Daily push reminders during the 7 days.

**Stage 3 — Admin Review (post grace window):**
- A new admin page `/admin/vault-claims` (gated by `has_role('admin')`) lists `status='user_window_open'` claims whose window has ended.
- Admin views: death certificate, nominee ID proof, original guardian nomination history (`guardians` table), user's last login timestamp, last `check_ins` activity. Two actions: **Release** or **Reject (with reason)**.
- **Release** → edge function `vault-release-claim`:
  - Generates a one-time, expiring (24 h) **claim portal link** with a token (similar to `journey_share_tokens`).
  - Emails + SMSes link to the nominee guardian's verified contact.
  - Sets `status='released'`, `released_at=now()`.
  - Logs to `admin_audit_log`.

**Stage 4 — Nominee Vault Access (one-time, time-boxed):**
- The link opens a public route `/vault-claim/:token` with a server-rendered claim page.
- Nominee must enter a 6-digit OTP sent to the guardian phone on landing.
- After OTP, nominee sees a **read-only export view** of:
  - Bank Accounts with nominee details, Insurance policies with nominee details, Will reference, Legal Will partner contact, Identity docs, Email accounts.
- All decryption happens server-side using a **claim-time symmetric key** that was derived during Release: at Release, the admin function uses the user's vault PIN escrow (see §D below) to re-encrypt entries with a fresh key bound to the claim token. The token expires in 24 h; data is purged from the temporary release table after expiry.
- Download as encrypted PDF (PIN = the OTP they used) and full-page print available.

---

### D. PIN escrow — solving the "user is dead so PIN is lost" problem

Today the vault PIN never leaves the device. For nominee release to work post-death, the user must opt-in to **PIN escrow** when nominating a Vault Nominee:
- A new dialog asks the user to "Enable Nominee Recovery". On confirm, the PIN is wrapped using a **Shamir 2-of-3 secret share** generated client-side:
  - Share 1 → encrypted with admin's published public key, stored in `vault_pin_escrow` (admin can never read alone).
  - Share 2 → printed/emailed to the user as a recovery code (they can give it to their lawyer).
  - Share 3 → stored encrypted with the nominee guardian's auth-derived key, released only on Release.
- At Release, admin + guardian shares combine to reconstruct the PIN, which unwraps the user's vault for one-time export. If the user never enabled escrow, the Vault claim link only exposes **metadata** (insurance company name, policy number masked, etc., based on `vault_reminder_meta`), and the nominee is told to contact each company directly.

This stays zero-knowledge under normal use (no admin can read alone, no guardian can read alone, user's own daily access still uses just their PIN locally).

---

### E. Cron + edge functions

- `vault-reminder-scan` — daily at 09:00 IST via pg_cron; reads `vault_reminder_meta`, fires `insert_notification_deduped` for any entry where `next_reminder_at <= now() + interval '24 hours'`, then advances `next_reminder_at` to the next tier (7d → 3d → 24h → renewal-day → done).
- `legal-will-partner` — POST `{ user_id, action: 'create'|'update', payload }` → returns partner deep-link URL. Stub today, real partner API later.
- `vault-claim-initiated` — handles claim creation, notifies user + guardians + admin.
- `vault-cancel-claim` — auth'd as the deceased user; sets status='cancelled' + admin audit row.
- `vault-release-claim` — admin-only; generates `vault_release_tokens` row + emails nominee.
- `vault-claim-otp-verify` — public; verifies OTP and serves decrypted release payload.

All edge functions validate JWT in code and use Zod for input validation.

---

### F. UI surface map

- `MedicalVault.tsx` Vault tab — accordion with 5 sections + per-section CRUD dialogs.
- `Settings.tsx` Guardians tab — new "Vault Nominee" toggle + "Enable Nominee Recovery" wizard.
- `GuardianDashboard.tsx` — "Vault Nominee Access" card (only if eligible).
- New page `src/pages/AdminVaultClaims.tsx` — admin queue.
- New public page `src/pages/VaultClaim.tsx` — nominee claim portal with OTP gate.
- Existing `notifications` system handles all in-app reminder UI; no new notification component.

---

### G. What I will NOT change

- No change to `medical_records`, `face_scans`, `health_profile`, `medication_logs` schemas.
- No change to existing identity docs flow — they migrate cleanly to `category='identity'` via the migration default.
- No change to Records / Visual / Dr Report / Analyzer / Profile tabs.
- No new payment flow; partner-Will integration is a stub returning a deep-link URL only.

---

### Verification

1. Open **Medical Vault → Vault**, unlock with PIN → see 5 collapsible sections (Identity, Emails, Banks, Insurance, Will). Add an Insurance entry with `renewal_date = today + 7 days` → notification appears immediately; another fires 4 days later (3-day mark) and again at 24 h.
2. Add a Will entry → 90 days later (or by manually editing `last_reviewed`) a quarterly review notification appears.
3. In **Settings → Guardians**, mark one guardian as Vault Nominee → toggle persists; "Enable Nominee Recovery" wizard runs and shows the user's recovery code share.
4. Log in as that guardian → **Guardian Dashboard** shows "Vault Nominee Access" card → upload death cert + ID → claim row created with `status='docs_uploaded'`.
5. Log in as the deceased user during the 7-day window → blocking banner appears → tap "Cancel Claim" → claim moves to `cancelled`, no release happens.
6. After window ends without cancellation → admin opens `/admin/vault-claims` → reviews docs → taps **Release** → nominee receives SMS + email with claim link.
7. Open claim link → enter OTP → see decrypted Bank/Insurance/Will summary with nominee details → download PDF → 24 h later the link no longer works.
8. Existing Identity docs (Aadhaar, PAN, etc.) still load and decrypt with the user's daily PIN — no regression.

