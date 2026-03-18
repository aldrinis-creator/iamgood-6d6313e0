

# Multi-Feature Health Tools Build

This is a large scope request with 4 distinct areas. Here is the plan.

---

## 1. Add Ambulance tab to Guardian Dashboard

Replace the inline ambulance booking card in `GuardianDashboard.tsx` with the full `AmbulanceBooking` component (same one used in My Health).

---

## 2. My Health: Only show selected tab content (hide grid)

When a tool is selected, hide the tools grid and show only that tool's content with a back button. Currently both the grid and content show simultaneously.

**File:** `src/pages/MyHealth.tsx`
- When `selectedTool` is set, hide the grid, show a header with back arrow + tool name, and render only that tool's content.

---

## 3. Build Health Tools sub-tabs (6 AI-powered features)

Create full components for each Health Tools sub-item, matching the screenshots:

### 3a. Doctor Visit Report (`src/components/health-tools/DoctorVisitReport.tsx`)
- Generate a doctor visit summary report pulling data from profile, vitals, medications, activity, face scans, and care journal.
- "Download PDF" and "Share" buttons.
- Uses AI (edge function) to generate a narrative summary.

### 3b. Medical Documents (`src/components/health-tools/MedicalDocuments.tsx`)
- Upload/view documents stored in the existing `medical-documents` storage bucket.
- Search by title/tags, filter by type.
- Scan button for camera capture.
- Reuse patterns from MedicalVault page if applicable.

### 3c. Document Analyzer (`src/components/health-tools/DocumentAnalyzer.tsx`)
- Upload a medical document (Medical Images, Lab Reports, Prescriptions, Doctor's Notes categories).
- Send to AI edge function for plain-language analysis.
- Display results with explanation.

### 3d. Symptom Checker (`src/components/health-tools/SymptomChecker.tsx`)
- Chat-style AI interface matching screenshot.
- Emergency symptoms warning banner at top.
- Text input for symptoms, AI responds with guidance.
- Disclaimer: "Not a diagnosis."
- Uses a new `symptom-checker` edge function.

### 3e. Medication Info (`src/components/health-tools/MedicationInfo.tsx`)
- Search tab: search any medication by name, get AI-powered info (uses, side effects, interactions).
- Banned List tab: show list of banned medications in India.
- Common searches quick chips.
- Disclaimer banner.
- Uses a new `medication-info` edge function.

### 3f. Tele-Consult (`src/components/health-tools/TeleConsult.tsx`)
- 3 tabs: Record, Video Call, History.
- Record: Audio/Video toggle, start recording, AI transcription.
- Video Call: placeholder for future integration.
- History: list of past consultations.
- Disclaimer at bottom.

### 3g. Emergency First Aid (`src/components/health-tools/EmergencyFirstAid.tsx`)
- Add as a new item in Health Tools sub-items.
- Grid of first aid guides (CPR, Bleeding, Burns, Allergic Reactions, Heart Attack, Poisoning).
- Each guide expands to show step-by-step instructions.
- "Call 911" emergency banner.

**Edge Functions to create:**
- `supabase/functions/health-tools/index.ts` — multi-purpose AI edge function handling: `doctor_report`, `document_analysis`, `symptom_check`, `medication_info` request types.

**Wire up:** Update `MyHealth.tsx` Health Tools section to render these components when their sub-item is clicked (add `selectedSubTool` state).

---

## 4. Tablets tab: Banned Medications + Refill sync

### 4a. Add "Banned" tab to MedicationManager
- Add a 5th tab "Banned" to `MedicationManager.tsx`.
- New component `src/components/medications/BannedMedications.tsx`:
  - Search input + AI-powered lookup of India's banned medication list.
  - Common searches chips.
  - Uses `medication-info` edge function with type `banned_check`.

### 4b. Sync with RefillOrder
- In `RefillOrder.tsx`, cross-check user's medications against known banned drugs.
- Show a red warning badge on any medication that matches a banned drug.
- Use the same edge function to verify.

---

## Technical Details

**New files:**
- `src/components/health-tools/DoctorVisitReport.tsx`
- `src/components/health-tools/MedicalDocuments.tsx`
- `src/components/health-tools/DocumentAnalyzer.tsx`
- `src/components/health-tools/SymptomChecker.tsx`
- `src/components/health-tools/MedicationInfo.tsx`
- `src/components/health-tools/TeleConsult.tsx`
- `src/components/health-tools/EmergencyFirstAid.tsx`
- `src/components/medications/BannedMedications.tsx`
- `supabase/functions/health-tools/index.ts`

**Modified files:**
- `src/pages/MyHealth.tsx` — hide grid on selection, add sub-tool state for Health Tools
- `src/pages/GuardianDashboard.tsx` — replace inline ambulance with `AmbulanceBooking`
- `src/components/medications/MedicationManager.tsx` — add Banned tab
- `src/components/medications/RefillOrder.tsx` — add banned drug warnings

**Edge function `health-tools`** handles multiple types via `{ type, payload }`:
- `symptom_check`: chat-style symptom analysis
- `medication_info`: drug information lookup
- `banned_check`: check if a medication is banned in India
- `document_analysis`: analyze uploaded medical documents
- `doctor_report`: generate visit report narrative

All use `LOVABLE_API_KEY` (already configured) with `google/gemini-3-flash-preview`.

No database migrations needed — all features use existing tables (medications, activity_logs, face_scans, care_journal, profiles) or are stateless AI calls.

