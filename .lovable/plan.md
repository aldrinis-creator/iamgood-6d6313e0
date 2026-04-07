

## Add "Save to Vault" for All Health Tool Reports

### What Changes

Add a "Save to Vault" button to every Health Tool that generates an AI report. After saving, show a toast: *"Your Report is saved in the Vault in Reports in the [Tool Name] tab"*. Also add `ReportShareButtons` (Print/WhatsApp/Email) where missing.

### Components to Update

**1. `src/components/health-tools/DoctorVisitReport.tsx`**
- Add a "Save to Vault" button below the report (same pattern as DocumentAnalyzer)
- Save to `medical_records` with `record_type: "Doctor's Diagnosis"`, title including date
- Add `ReportShareButtons` (already present ✅)
- Toast: "Your Report is saved in the Vault in Reports in the Doctor Visit Report tab"

**2. `src/components/health-tools/SymptomChecker.tsx`**
- Add a "Save to Vault" button that appears once there's at least one assistant response
- Concatenate the full chat history into a markdown string for saving
- Save to `medical_records` with `record_type: "AI Analysis"`, title: "Symptom Check — [date]"
- Add `ReportShareButtons` for the conversation
- Toast: "Your Report is saved in the Vault in Reports in the Symptom Checker tab"

**3. `src/components/health-tools/MedicationInfo.tsx`**
- Add "Save to Vault" button when drug search `result` or `bannedResult` is present
- Save to `medical_records` with `record_type: "AI Analysis"`, title: "Medication Info — [drug name] — [date]"
- Add `ReportShareButtons` for each result
- Toast: "Your Report is saved in the Vault in Reports in the Medication Info tab"

**4. `src/components/health-tools/DocumentAnalyzer.tsx`**
- Update existing toast from "Saved to Medical Vault" to "Your Report is saved in the Vault in Reports in the Document Analyzer tab"

### Implementation Pattern (shared across all)

Each component gets:
- `saving` and `saved` boolean state
- `saveToVault` async function that inserts into `medical_records`
- A button: Save icon → Spinner → Checkmark
- `useAuth` import for `user.id`
- Consistent toast message referencing the tool name

### No Database Changes Required
The `medical_records` table already supports these inserts with existing RLS policies.

