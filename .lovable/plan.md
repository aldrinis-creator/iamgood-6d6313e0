

## Plan — Visual Checks Analysis tab in Medical Vault

Add a fourth tab in **Medical Vault** that holds all results from **Urine Check, Tongue Analysis, and Face Scan** under a single record type so they're easy to find, while keeping every existing record (today saved as `Lab Report`) accessible by migrating them.

### 1. New record_type: `"Visual Check"`

A new shared category used by all three tools. Stored in the existing `medical_records` table — no schema change.

### 2. `src/components/health-tools/UrineCheck.tsx`
- Change the `saveToVault` insert from `record_type: "Lab Report"` to `record_type: "Visual Check"`.
- No other behaviour change.

### 3. `src/components/health-tools/TongueAnalysis.tsx`
- Change the `saveToVault` insert from `record_type: "Lab Report"` to `record_type: "Visual Check"`.

### 4. `src/components/FaceScan.tsx` — **save to vault by default**

Today Face Scans only persist to the `face_scans` table; nothing lands in Medical Vault. Add an automatic insert into `medical_records` after a successful scan (live, photo, or video):
- `record_type: "Visual Check"`
- `title: "Face Scan — <date>"`
- `description: JSON.stringify({ heartRate, stressLevel, stressScore, confidence, photo_indicators? }, null, 2)`
- `record_date: today (IST)`
- For photo-mode scans, also upload the original image to the `medical-documents` bucket and set `file_url` / `file_name` (mirrors UrineCheck/TongueAnalysis behaviour). Live/video modes save without a file.
- Wrap in try/catch — a Vault save failure must NOT break the existing `face_scans` insert or the results UI; show a silent console warning only.

### 5. `src/pages/MedicalVault.tsx` — new "Visual Checks" tab

- Change `TabsList` from `grid-cols-3` to `grid-cols-4` and add a new trigger `value="visual"` with an `Eye` icon and label **"Visual"**.
- Add a `TabsContent value="visual"` block that renders only records where `record_type === "Visual Check"`, sorted newest-first. Reuse the same card layout (View / Save As / Share / Delete) and the existing `handleViewRecord` dialog so JSON descriptions and any attached image render with the existing preview path.
- Add `"Visual Check"` to the `RECORD_TYPES` constant so it appears in the upload-form dropdown and Records-tab filter chip too. The Records tab continues to show all records (including Visual Checks) — the new tab is a focused view.
- Empty state: "No visual check results yet. Run a Urine, Tongue, or Face scan from My Health → Health Tools."

### 6. Migration of existing reports

Existing Urine, Tongue (and any prior Face) saves live as `record_type = "Lab Report"`. To move them into the new tab without losing other true Lab Reports (e.g., Vitals device reports, Pill ID), migrate by **title prefix** which uniquely identifies them:

```sql
UPDATE public.medical_records
SET record_type = 'Visual Check'
WHERE record_type = 'Lab Report'
  AND (
    title LIKE 'Tongue Check —%'
    OR title LIKE 'Urine Color Check —%'
    OR title LIKE 'Urine Dipstick —%'
    OR title LIKE 'Urine Check —%'
    OR title LIKE 'Face Scan —%'
  );
```

Run via the migration tool. Vitals device reports (`"Device Report Analysis - …"`) and Pill IDs (`"Pill ID: …"`) are intentionally left as `Lab Report` since they aren't visual screenings.

### What I will NOT change
- No changes to `face_scans`, `medication_records` schemas or RLS.
- No changes to PillIdentifier, VitalsMonitor, DocumentAnalyzer, or other tools.
- No change to MyHealth routing or Health Tools tile order.
- The Records tab keeps showing everything — Visual tab is additive.

### Verification
1. Open **Medical Vault** → see four tabs: Records, **Visual**, Profile, Vault.
2. Run a Urine Check → tap **Save to Vault** → record appears under **Visual** with attached image preview.
3. Run a Tongue scan → save → appears under **Visual**.
4. Run a Face Scan (live or photo) → results screen renders as today, AND a new "Face Scan — <date>" card auto-appears under **Visual** (photo mode includes image preview).
5. Pre-existing Tongue/Urine "Lab Report" records now appear under **Visual** (migration).
6. Vitals device reports and Pill ID entries remain under Records → "Lab Report" filter, not under Visual.

