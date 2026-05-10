# Hospital Visit Tab — Admission Kit for Guardians

## Goal
Give guardians a one-tap "Admission Kit" for hospital reception: ward's Aadhaar, PAN, Health Insurance (primary + secondary), and a recent photo — bundled into a single branded PDF, shareable via WhatsApp.

## User Flow

**Ward side (new):**
- New "ID & Insurance" section in ward's MyProfile (or as a dedicated card on My Health) with 5 fixed slots:
  1. Aadhaar Card
  2. PAN Card
  3. Health Insurance — Primary
  4. Health Insurance — Secondary (optional)
  5. Passport Photo (with "Take selfie" camera shortcut)
- Each slot shows: thumbnail, Replace, Delete. Empty slots show a prominent Upload button.

**Guardian side (new):**
- New 7th tab in Guardian Reports: **"Hospital Visit"** (icon: `BriefcaseMedical`).
- Shows 5 doc cards with status chips (✅ Available / ⚠️ Missing).
- Each card: tap to preview (image/PDF in Dialog), Download.
- Sticky top action bar:
  - **"Download Admission Kit (PDF)"** — merges all available docs into one branded PDF with a cover page (ward name, DOB, blood group, allergies, primary guardian phone, emergency contacts).
  - **"Share via WhatsApp"** — sends the PDF + a templated message to a chosen number.
  - **"Nudge {ward}"** button appears when ≥1 doc is missing → in-app notification + optional WhatsApp template asking ward to upload.

## Technical Details

### Data model
Reuse `medical_records` table + `medical-documents` storage bucket. Add a new column `record_slot text` to tag fixed-slot docs (values: `aadhaar`, `pan`, `insurance_primary`, `insurance_secondary`, `id_photo`). Backwards compatible — existing records have `record_slot = null` and continue to flow into the regular Medical Documents view.

Unique partial index on `(user_id, record_slot)` where `record_slot is not null` so each slot holds exactly one current record (replace = delete + insert, or update file_url).

RLS: existing policies already allow guardians to read their accepted ward's `medical_records` — no changes needed. Verify during implementation.

### Ward UI
- New component `src/components/profile/IdInsuranceSection.tsx` with 5 slot cards.
- Reuses upload/camera logic from `MedicalDocuments.tsx`.
- Mounted inside `MyProfile.tsx` as a collapsible section, plus a "Hospital ID Kit" entry-point card on `MyHealth.tsx`.

### Guardian UI
- Add `hospital_visit` to `ReportSection` enum in `GuardianReports.tsx`.
- New component `src/components/guardian/HospitalVisitTab.tsx` that fetches the 5 slot records for `selectedWard.userId`, generates 1-hour signed URLs (matching Medical Vault pattern), and renders the cards + action bar.
- New component `src/components/guardian/HospitalDocPreviewDialog.tsx` (img/iframe preview).

### PDF generation (Admission Kit)
- New helper `src/lib/admissionKitPdf.ts` using `jsPDF` (already in project via `reportPdf.ts`).
- Cover page: Check-iN letterhead (per existing PDF branding memory), ward photo top-right, ward name + DOB + blood group + allergies + primary guardian phone + emergency contacts.
- Subsequent pages: each doc embedded full-page (images via `addImage`, PDFs flattened by fetching the file and embedding pages — for v1, embed PDFs as a "see attached" link page if PDF-merge is heavy; revisit if needed).
- Output as Blob → download or pass to WhatsApp share.

### WhatsApp share
- Reuse `src/lib/whatsapp.ts` pattern. Generate a public, time-limited shareable link to the PDF (upload generated PDF to a new `admission-kits` private bucket with 24h signed URL) and send via wa.me with a templated message: "Here is {ward}'s hospital admission kit. Link valid 24h: {url}".
- New private bucket `admission-kits` with RLS: only the generating guardian can read; auto-cleanup via cron (out of v1 scope — accept as known debt).

### Nudge ward
- Reuse `insert_notification_deduped` RPC with type `id_doc_missing` and message listing missing slots.
- Optional MSG91 WhatsApp template (out of v1 unless a template already exists; v1 = in-app notification only).

## Out of Scope (v1)
- Auto-cleanup cron for `admission-kits` bucket.
- OCR/validation of Aadhaar/PAN numbers.
- Multi-ward bundle (one ward at a time).
- Editing the cover page contents inline (pulled from existing profile/emergency data).

## Verification
- Ward uploads all 5 docs → Guardian sees ✅ on all 5 cards.
- Ward removes Insurance Secondary → Guardian sees ⚠️ on that card; "Nudge" button enabled.
- Tap "Download Admission Kit" → single PDF with cover + each doc page renders correctly.
- Tap "Share via WhatsApp" → wa.me opens with prefilled message + signed URL.
- Guardian without accepted nomination cannot see ward's docs (RLS check).
- Mobile-first 430px max width respected; min 18px font.

## Files Touched
- **New:** `src/components/profile/IdInsuranceSection.tsx`, `src/components/guardian/HospitalVisitTab.tsx`, `src/components/guardian/HospitalDocPreviewDialog.tsx`, `src/lib/admissionKitPdf.ts`
- **Edited:** `src/pages/MyProfile.tsx`, `src/pages/MyHealth.tsx`, `src/pages/GuardianReports.tsx`
- **Migration:** add `record_slot` column + partial unique index on `medical_records`; create `admission-kits` storage bucket with guardian-scoped RLS
