# Seamless Hospital Kit — Images Only + On-Demand PDF

## Goal

1. The ward only ever uploads/stores **image files** (JPEG / PNG / TIF) per slot — no PDFs in storage.
2. The Admission Kit is generated **on demand** as a single PDF with all those images embedded, ready for the guardian to download or share.

## Current behavior (why it's not seamless)

- For Aadhaar / PAN (front+back) and Insurance (multi-page), `IdMultiPageField` merges captured pages into a **PDF on the device**, then uploads that PDF to storage. One `medical_records` row per slot.
- Guardian's Admission Kit PDF (in `admissionKitPdf.ts`) only **embeds images**; for stored PDFs it falls back to a "see PDF link" page — so multi-page IDs aren't visible inline.
- Original captures are lost (only the merged PDF survives), so we can't re-embed them later.

## New behavior

- Each captured page is stored as its **own image file** (JPEG output from the cropper, ~quality JPEG) under `medical-documents/{wardUserId}/slots/`.
- `medical_records` allows **multiple rows per slot**, ordered by `page_index`.
- The guardian's "Download PDF" button assembles a single Admission Kit PDF with **every page of every slot embedded as an image**, in the correct order.
- No PDF is ever stored in `medical-documents` for Hospital Kit slots — only when the guardian shares, the generated kit PDF is uploaded to the existing `admission-kits` bucket for the 24h link (already in place).

## Changes

### 1. Database (migration)

- Add `page_index INTEGER NOT NULL DEFAULT 0` to `public.medical_records`.
- Drop the `UNIQUE (user_id, record_slot)` constraint if present; add `UNIQUE (user_id, record_slot, page_index)` so each page slot is distinct.
- One-time backfill: for existing slot rows that point to a `.pdf` file, leave them as-is for backward viewing but mark `page_index = 0`. New uploads will always be images.
- Expand `record_type` CHECK constraint (already covers the 5 slot types from the last migration — no change needed).

### 2. Capture flow — `src/components/profile/IdMultiPageField.tsx`

- Remove `jsPDF` merge logic and the PDF accept path.
- Restrict file picker `accept` to `image/jpeg,image/png,image/tiff` for all modes.
- `onComplete` becomes `onComplete(files: File[])` — emits the ordered list of cropped JPEG pages, no merging.
- Update copy: "Pages are stored as images and combined into the Admission Kit PDF when your guardian downloads it."

### 3. Upload logic — `src/components/profile/IdInsuranceSection.tsx`

- `uploadFile` becomes `uploadPages(slot, files[])`:
  - Delete all existing slot-owned rows + their storage objects for this slot (clean replace).
  - For each file, upload to `…/slots/{slotKey}-{pageIndex}-{ts}.{ext}` with proper `contentType`.
  - Insert one `medical_records` row per page with `record_slot`, `record_type`, `page_index = i`, `file_url`, `file_name`, `title = "{slot.label} — Page {i+1}"`.
  - On any failure, rollback already-uploaded storage objects for that batch and show "Save failed — please try again".
- `fetchRecords` returns an array per slot (`SlotRecord[]`), sorted by `page_index`.
- UI per slot shows total pages, e.g. "Aadhaar — 2 pages saved", with a preview gallery (thumbnails) and a single "Re-capture" button that reopens `IdMultiPageField`.

### 4. Slot resolution — `src/lib/hospitalKitSlots.ts`

- Update `resolveSlotRows` to return `{ row[] , source }` instead of `{ row, source }`.
- Vault fallback stays single-row.

### 5. Guardian view — `src/components/guardian/HospitalVisitTab.tsx`

- Each slot card shows page count and a small thumbnail strip (1st page preview).
- "View" opens a dialog that cycles through all pages of that slot.
- "Download PDF" calls the updated `buildAdmissionKitPdf` with the full multi-page payload.

### 6. PDF builder — `src/lib/admissionKitPdf.ts`

- `AdmissionKitDoc` becomes:
  ```ts
  { slot, label, pages: { signedUrl, fileName, mime }[] }
  ```
- Cover page lists each slot with page count (e.g. "Aadhaar — 2 pages").
- For each slot, emit one PDF page per image, fit-to-A4 with the slot label + "Page N of M" header. TIFFs are converted to JPEG via an offscreen `<canvas>` before `addImage`.
- Drop the "stored PDF link" fallback path (no PDFs in slots anymore). Legacy PDF rows (from before this change) still render as a link page so old data isn't broken.

### 7. Sharing path — unchanged

- WhatsApp share still uploads the generated kit PDF to `admission-kits` and creates a 24h signed URL.

## Technical notes (for engineer)

```text
medical_records
 ├─ user_id, record_slot=aadhaar,            page_index=0, file_url=…/aadhaar-0-….jpg
 ├─ user_id, record_slot=aadhaar,            page_index=1, file_url=…/aadhaar-1-….jpg
 ├─ user_id, record_slot=insurance_primary,  page_index=0, file_url=…/insurance_primary-0-….jpg
 └─ …
```

- File naming uses `slotKey-pageIndex-timestamp.ext` so listings remain debuggable.
- Cropper already outputs JPEG; we only widen the **input** accept list to JPEG/PNG/TIF, then convert on canvas to JPEG before upload to keep storage uniform and small.
- Storage RLS: unchanged — guardians already read via folder-owner policy.

## Out of scope

- No change to non-Hospital-Kit medical vault uploads (PDFs still allowed there).
- No change to Subscription / Guardian nomination flows.
- No change to the WhatsApp share / 24h link mechanism.
