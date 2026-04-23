

## Plan — Restructure Medical Vault tabs + auto-shut Profile/Records on idle + slim Health Tools

### A. Two new Medical Vault tabs (`src/pages/MedicalVault.tsx`)

Grow `TabsList` from `grid-cols-4` to `grid-cols-6` and add two new triggers between **Visual** and **Profile**:

1. **Doctor Visit Report** (`value="doctor-report"`, `FileText` icon, label "Dr Report"). Renders the existing `<DoctorVisitReport />` component **inline at the top** so users can generate a new report from inside the Vault, followed by a list of all saved doctor reports — `records.filter(r => r.record_type === "Doctor's Diagnosis")` sorted newest-first, using the same View / Save As / Share / Delete card layout as the Records tab. Empty state: "No doctor visit reports yet — tap Generate above."

2. **Document Analyzer** (`value="doc-analyzer"`, `Search` icon, label "Analyzer"). Renders the existing `<DocumentAnalyzer />` component **inline at the top** for new uploads/analysis, followed by a list of every saved analysis. Filter rule: any record whose `record_type` is one of `["Lab Report", "X-Ray / Scan", "Discharge Summary", "Doctor's Diagnosis", "Insurance Document"]` AND was created via the analyzer — since the existing `DocumentAnalyzer.saveToVault` writes a single `record_type`, we widen the filter to that 5-item set so all parsed medical documents land here. Same card layout as Records tab. Empty state: "No analyzed documents yet — upload a report above."

Note: `DoctorVisitReport.saveToVault` already inserts as `"Doctor's Diagnosis"` and `DocumentAnalyzer.saveToVault` writes one of the lab/xray/discharge types, so no save-side changes are needed — the new tabs are purely a focused view of existing data.

### B. Trim `RECORD_TYPES` filter chips + upload dropdown (`src/pages/MedicalVault.tsx`)

Replace:
```ts
const RECORD_TYPES = [
  "Doctor's Diagnosis", "Lab Report", "Visual Check", "Discharge Summary",
  "X-Ray / Scan", "Insurance Document", "Vaccination Record", "Legal Will", "Other",
];
```
with:
```ts
const RECORD_TYPES = ["Visual Check", "Vaccination Record", "Other"];
```

This affects only the **Records tab UI** (chip row + manual upload dropdown). The 6 removed labels stay valid in the DB (the check constraint still permits them — see §D), so existing records remain viewable in Records and continue to be filterable by the new tabs above. Auto-saved Doctor Reports / analyzed documents continue inserting their original `record_type` strings; they just no longer appear as user-facing chips.

### C. Auto-shut Records & Profile tabs after 30s idle (`src/pages/MedicalVault.tsx`)

Convert the `<Tabs defaultValue="records">` into a controlled component with `const [activeTab, setActiveTab] = useState("records")`. Add a `useEffect` that, whenever `activeTab === "records" || activeTab === "profile"`, starts a 30-second `setTimeout` and resets it on `pointerdown`, `keydown`, `scroll`, and `touchstart` listeners on the page container. On expiry, call `setActiveTab("records")` only when leaving Profile, **OR** for both: collapse to a neutral landing — chosen behaviour: switch back to a new lightweight default `value="records"` but with `setShowUploadForm(false)`, `setSearchQuery("")`, and clearing the `viewRecord` dialog so any open card/preview closes too. The Doctor Report / Analyzer / Visual / Vault tabs are excluded (long-running AI work shouldn't be interrupted). Show a subtle toast: "Tab auto-closed for privacy" the first time it fires per session.

### D. Database — no migration required

The existing check constraint already permits all 9 historical record types plus `"Visual Check"`. Removing labels from the UI dropdown does not need a constraint change. **Skip migrations.**

### E. Remove Medical Documents from Health Tools (`src/pages/MyHealth.tsx`)

- Remove the `{ icon: Upload, label: "Medical Documents", desc: "Upload and organize medical documents" }` entry from `healthToolsSubItems`.
- Remove `"Medical Documents": MedicalDocuments` from `subToolComponents`.
- Remove the `import MedicalDocuments from "@/components/health-tools/MedicalDocuments"` line.

The file `src/components/health-tools/MedicalDocuments.tsx` is left on disk (no other importers) but is now dead code — safe to leave; deletion is optional.

### What I will NOT change

- No change to `DoctorVisitReport.tsx`, `DocumentAnalyzer.tsx`, `UrineCheck.tsx`, `TongueAnalysis.tsx`, or `FaceScan.tsx`.
- No change to `medical_records` schema, RLS, or storage bucket.
- No change to the Visual / Vault tabs, the Records list rendering, or the View Record dialog.
- No change to MyHealth top-level tile grid (only the "Health Tools" hub sub-list loses one row).

### Verification

1. Open **Medical Vault** → see 6 tabs in order: **Records · Visual · Dr Report · Analyzer · Profile · Vault**.
2. Tap **Dr Report** → DoctorVisitReport UI loads at top; all previously-saved doctor reports list below.
3. Tap **Analyzer** → DocumentAnalyzer UI loads at top; all previously-saved lab reports / X-rays / discharge summaries / diagnoses / insurance docs list below.
4. Switch to **Records** → filter chip row shows only **All · Visual Check · Vaccination Record · Other** (the 6 removed labels are gone). Existing records of any type still appear in the unfiltered list.
5. Stay on **Records** for 30s with no input → toast appears, Records collapses to its default (search cleared, upload form closed, dialog closed). Repeat on **Profile** → same auto-shut. Stay on **Dr Report** / **Analyzer** / **Visual** / **Vault** for 60s → no auto-shut.
6. Open **My Health → Health Tools** hub → "Medical Documents" tile is gone; the other 5 sub-tools remain.

