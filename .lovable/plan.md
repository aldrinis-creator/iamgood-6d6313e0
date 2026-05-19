## Goal

Make the Guardian account a lightweight monitor identity. Remove all ward-style health, ID, medication, and "my guardians" sections from a Guardian's profile, and clean up any existing data those sections may have written.

## Scope of change

### 1. Guardian My Profile — keep only

- Full name
- Phone (login identifier, read-only)
- Email (optional)
- Profile photo / avatar
- One personal emergency contact (name + phone + relation) — so the system knows who to call if the guardian themselves has an incident
- Language preference (already lives in Guardian Settings)

### 2. Remove from Guardian profile entirely

- Body Metrics (height, weight, BMI, etc.)
- Body & Health / vitals baselines
- Past Medical History
- ID & Insurance (Aadhaar, PAN, insurance cards, multi-page uploads)
- Family Doctor
- My Guardians (a guardian doesn't nominate sub-guardians)
- Current Medications
- AES-256-GCM client-side encryption + PIN gate (`VaultGate`, `encryption.ts` usage) — not needed for the minimal guardian fields

### 3. Routing behaviour

When a guardian (role check via `useAuth` + `user_roles`) lands on `/my-profile` or any sub-route that renders one of the removed sections, show a friendly empty state:

> "This section isn't available for Guardian accounts. Your profile only needs basic contact details — manage them in Guardian Settings."

with a CTA button → `/guardian-settings` (Profile tab). Do **not** silently redirect; the message clarifies why the section is missing.

### 4. Data cleanup (hard delete) for existing guardian rows

For every account whose role in `user_roles` is `guardian` (and only those), delete rows from:

- `health_profile`
- `medical_history`
- `encrypted_documents` (ID & insurance, family doctor cards, etc.)
- `health_passport_scores`
- `face_scans`
- `activity_logs`, `meal_logs` (body metrics / nutrition)
- `medications` table (current medications) and any related medication schedule/alarm rows
- `guardians` rows where `user_id` = the guardian account (i.e. sub-guardians they nominated as if they were a ward) — but **NEVER** delete rows where `guardian_user_id` = the guardian account (those are their wardship links and must stay)

This will be a single migration with a `DELETE … WHERE user_id IN (SELECT user_id FROM user_roles WHERE role = 'guardian')`-style block per table, executed once.

### 5. Guardian Settings Profile tab

Extend the existing `GuardianSettings.tsx` Profile tab to also hold the avatar upload and the single personal emergency contact (new lightweight fields on `profiles` — `avatar_url` likely already exists; add `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation` to `profiles` if not present, plain text, no encryption).

## Files to change

- `src/pages/MyProfile.tsx` — branch on role: guardians get the lightweight view (name, phone, email, avatar, personal emergency contact) and a link to Guardian Settings; everything else hidden.
- `src/components/profile/IdInsuranceSection.tsx`, `IdMultiPageField.tsx`, `MyPersona.tsx`, `PastMedicalHistory.tsx`, `HealthPassport.tsx` (the personal one), `MedicationManager.tsx` mounts on profile — wrap in `if (role !== 'user') return <GuardianBlockedSection/>`.
- `src/components/VaultGate.tsx` — skip entirely for guardian role (no PIN prompt on profile).
- `src/pages/GuardianSettings.tsx` — add avatar uploader + emergency contact fields in Profile tab.
- New tiny component `GuardianBlockedSection.tsx` for the "not available" empty state.

## Technical details

- **Role detection**: use existing `useAuth().profile.role` (sourced from `user_roles`, never trust client storage).
- **Migration**: schema-only ADD COLUMN for the three `profiles.emergency_contact_*` fields; the data purge runs via the insert/delete tool (data, not schema).
- **RLS**: no policy changes needed — existing per-user policies cover the new columns.
- **Encryption**: `encryption.ts` and `encrypted_documents` table stay in place for ward (`user`) accounts; only the guardian path stops writing to / reading from them.
- **Memory**: add a new note `mem://features/guardian-profile-scope` ("Guardian profile is identity-only: name, phone, email, avatar, one personal emergency contact. No health/ID/meds/sub-guardians. No client-side encryption.") and update the Guardian Workflow / Guardian Settings memory entries to reference it.

## Out of scope

- Ward (`user` role) profile — unchanged.
- Encryption/PIN system itself — kept for wards.
- Auth flow, nominations, dashboard, alerts — unchanged.

## Risks

- Hard delete is irreversible — only runs against rows owned by accounts whose role is `guardian`. The migration will be reviewed before approval.
- If any guardian later gets converted to a ward (role change), they'll start fresh on health data — acceptable, that's effectively a new ward onboarding.

Approve and I'll execute: (a) schema migration for the three emergency-contact columns, (b) data purge migration, (c) UI changes, (d) memory update.
