# Fix: Admission Kit shows no documents despite ward uploads

## Root cause

I checked the database directly. **Across the entire `medical_records` table there are zero rows with `record_slot` set** — Aadhaar, PAN, Insurance Primary/Secondary, Passport Photo. The Admission Kit only reads slot-tagged rows, so it correctly shows nothing.

Your ward's actual uploads (Aadhaar, "Mom's Aadhaar Card", face/tongue/urine scans, etc.) live in `medical_records` but without a `record_slot`. So either:

1. **Silent save loss in the new 5-slot card.** In "front-back" and "pages" modes the user must explicitly press **Save (n)** in `IdMultiPageField`. If they close the dialog, click outside, or hit Cancel after adding pages, the cropped pages are silently discarded with no warning — only a `reset()`. No toast, no confirm. Very easy to do, especially with a long insurance policy where they "added all pages" and then closed.
2. **Wrong upload entry-point.** The ward may have uploaded via the older **Medical Vault → Add medical record** flow (which sets `record_type` like `"ID - Aadhaar"` / `"Insurance - Primary"` but **no** `record_slot`), so the Hospital Kit doesn't see them.

## Fix scope (UI/UX only — no DB schema, no RLS)

### 1. Prevent silent save loss in `IdMultiPageField.tsx`
- In `handleClose`, when `next === false` AND `pages.length > 0`, show a confirm AlertDialog: **"Discard N captured pages?"** with Discard / Keep editing. Only `reset()` on confirmed discard.
- Disable the dialog's outside-click + ESC dismissal while `pages.length > 0` (`onPointerDownOutside` / `onEscapeKeyDown` preventDefault on DialogContent).
- Add a subtle pulsing **Save** button when `pages.length >= 1` so it's visually obvious work is unsaved.
- After successful `onComplete`, show a clear success toast: **"{slot} saved — your guardian can see it now"** (currently the parent already toasts "saved", but add the guardian-visible reassurance).

### 2. Read fallback in `HospitalVisitTab.tsx` + `HospitalKitCard.tsx`
- When fetching ward records, also fetch rows where `record_slot IS NULL` but `record_type` matches the slot mapping:
  - `record_type ILIKE 'ID - Aadhaar%'` → aadhaar
  - `record_type ILIKE 'ID - PAN%'` → pan
  - `record_type ILIKE 'Insurance - Primary%'` → insurance_primary
  - `record_type ILIKE 'Insurance - Secondary%'` → insurance_secondary
  - `record_type ILIKE 'ID - Photo%'` → id_photo
- Slot-tagged rows take precedence over `record_type` matches (don't double-count).
- Surface a small "(linked from Medical Vault)" caption on those cards so guardian knows the source.

### 3. One-tap "Promote to Hospital Kit" on user side (`IdInsuranceSection.tsx`)
- If the ward has matching-`record_type` rows but no slot row, show an inline button on the empty slot card: **"Use existing {record_type} from Medical Vault"** that UPDATEs the row to set `record_slot = slot.key` (no re-upload needed). Single click closes the gap for historical uploads.

## Files to edit
- `src/components/profile/IdMultiPageField.tsx` — confirm-on-close, lock outside dismissal, pulse Save
- `src/components/profile/IdInsuranceSection.tsx` — fetch fallback `record_type` rows, render "Promote" CTA, link existing
- `src/components/guardian/HospitalVisitTab.tsx` — extend fetch + dedupe logic with `record_type` fallback
- `src/components/guardian/HospitalKitCard.tsx` — same `record_type` fallback in count query

## Out of scope
- No DB migration, no new RLS, no storage changes, no edge functions.
- No changes to Admission Kit PDF builder, WhatsApp share, or nudge flow.
- Won't touch Medical Vault upload UI itself.

## Verification plan
1. Open My Profile → 5-slot card, add 2 pages of insurance, close dialog without Save → expect confirm dialog (not silent loss).
2. After save, query DB → row should have `record_slot = 'insurance_primary'`.
3. As a guardian, open Reports → Hospital Visit → row should appear with View/Save working.
4. For ward with old Vault uploads, the empty slot card should show "Use existing …" button; clicking it should fill the slot.
