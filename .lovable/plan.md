

# Medical Vault & Profile Updates

## Summary
Six changes: (1) remove Govt ID Cards from My Profile and replace with Current Medications from the medications table, (2) remove Current Medications chip input and Guardian tab from Medical Vault, (3) add a "Medical Vault" header, (4) make Profile tab fully read-only pulling all My Profile data, (5) add "Legal Will" to vault document types + Upload button for vault docs, (6) add Save As & Share buttons to saved medical records.

---

## 1. My Profile — Replace Govt ID Cards with Current Medications

**File: `src/pages/MyProfile.tsx`**

- Remove the entire "Government ID Cards" card (lines 807-882) including Aadhaar/PAN encrypted doc logic, photo upload logic, and related state/handlers
- Replace with a "Current Medications" card that fetches from the `medications` table (same data as the Tablets tab)
- Display each medication as a read-only card showing: name, dosage, frequency, schedule times, stock level
- No editing here — just a view of what's in the medications table

## 2. Medical Vault — Remove Current Medications & Guardian Tab

**File: `src/pages/MedicalVault.tsx`**

- Remove the `ChipInput` for "Current Medications" and its state (`currentMedications`, `medicationInput`) from the Profile tab
- Remove the Guardian tab entirely (remove `<GuardianTab>` and change tab grid from `grid-cols-4` to `grid-cols-3`)
- Remove the `GuardianTab` import
- Keep Emergency Notes and Family Doctor fields as editable in the Profile tab

## 3. Medical Vault — Add Header

**File: `src/pages/MedicalVault.tsx`**

- Add a header section above the Tabs: `<h1>Medical Vault</h1>` with a Shield icon and subtitle, similar to how MyProfile has its header
- Place inside `MedicalVaultContent` at the top of the returned JSX

## 4. Medical Vault Profile Tab — Fully Read-Only from My Profile Data

**File: `src/pages/MedicalVault.tsx`**

- Make the Profile tab fully read-only — remove the editable Family Doctor, Emergency Notes, and Current Medications inputs
- Pull all data from `profiles`, `nutrition_personas`, `health_profile`, and `medications` tables
- Display: Personal Info, Body Metrics (with BMI), Body & Health (blood group, diet, allergies, conditions, activity, smoking, alcohol, preferences, goals), Family Doctor, Emergency Notes, Current Medications (from medications table), Guardians list
- Remove `saveHealthProfile` button and related state
- Keep "Download Emergency PDF" button

## 5. Vault Tab — Add "Legal Will" + Upload Button

**File: `src/pages/MedicalVault.tsx`**

- Add `"Legal Will"` to the `RECORD_TYPES` array
- In the vault (encrypted documents) tab, each document entry currently has no file upload — add an Upload button alongside the existing fields in the "Add Encrypted Document" dialog (this is for encrypted ID docs, not medical records)
- Actually, re-reading the request: the "Vault" tab contains encrypted IDs. The "Records" tab has medical documents. The user wants an Upload button for documents in the Vault tab. I'll add a file attachment option to the encrypted document flow in the Vault tab.

Wait — let me reconsider. The Vault tab stores encrypted text (Aadhaar, PAN numbers). The Records tab stores medical documents with file uploads. The user says "for all documents being entered in the Vault tab, add an Upload button" — this likely means adding file upload capability to the Vault tab's encrypted documents so users can attach scans/photos of their IDs alongside the encrypted numbers.

And "Legal Will" should be added to the document types in the Vault tab's `DOC_TYPES` array.

**Changes:**
- Add `{ key: "legal_will", label: "Legal Will", placeholder: "Will reference or details" }` to `DOC_TYPES`
- Add file upload option in the Add Encrypted Document dialog — allow attaching a file that gets stored in the `medical-documents` bucket

Actually, for simplicity and since the encrypted_documents table only stores encrypted text, I'll add file upload to the vault encrypted docs by storing the file in storage and keeping a reference. But the table doesn't have a file column. Let me keep it simpler: add a file upload button next to each encrypted doc entry (similar to the photo upload for Aadhaar/PAN that was in MyProfile). I'll store uploaded files in storage under `{userId}/vault_{doc_type}`.

## 6. Medical Records — Save As & Share Buttons

**File: `src/pages/MedicalVault.tsx`**

- For each saved medical record in the Records tab, add:
  - **Save As** button: downloads the file (reuses existing download logic but with "Save As" label)
  - **Share** button: uses the Web Share API (`navigator.share()`) to share the document

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/MyProfile.tsx` | Remove Govt ID Cards, add Current Medications view |
| `src/pages/MedicalVault.tsx` | Remove Guardian tab, remove editable profile fields, add header, make profile read-only, add Legal Will, add upload to vault docs, add Save As & Share to records |

No database changes needed.

