

# Document Analyzer Enhancement, Prescription→Doctor's Diagnosis Rename, Vault Integration & PDF Reports

## Overview
Four interconnected changes: (1) redesign Document Analyzer with color and better UX, (2) rename "Prescription" to "Doctor's Diagnosis" everywhere, (3) wire Document Analyzer + PrescriptionScanner saves into the "Doctor's Diagnosis" category in Medical Vault, (4) add PDF generation with share/print for all reports.

## 1. Document Analyzer Redesign
**File**: `src/components/health-tools/DocumentAnalyzer.tsx`

- Add gradient header card with colored icon background
- Color-code category buttons (Medical Images = blue, Lab Reports = green, Doctor's Diagnosis = amber, Doctor's Notes = teal) with filled backgrounds when selected
- Add colored section headers in the results view (e.g., colored left border on the results card)
- Improve the upload area with a subtle gradient border animation
- Add a colored progress bar (primary gradient) during analysis
- Results card: add colored badges for category, section dividers, and a soft background tint
- Rename "Prescriptions" category to "Doctor's Diagnosis"

## 2. Rename "Prescription" → "Doctor's Diagnosis"

| File | Changes |
|------|---------|
| `src/components/health-tools/DocumentAnalyzer.tsx` | Category label |
| `src/components/medications/PrescriptionScanner.tsx` | All user-facing text: title, placeholders, button labels, save record_type |
| `src/components/medications/MedicationManager.tsx` | Tab label if visible |
| `src/pages/MedicalVault.tsx` | `RECORD_TYPES` array: replace "Prescription" with "Doctor's Diagnosis" |
| `src/pages/MyHealth.tsx` | healthToolsSubItems label if applicable |
| `src/components/health-tools/MedicalDocuments.tsx` | RECORD_TYPES if duplicated |

## 3. Save to Medical Vault as "Doctor's Diagnosis"

**DocumentAnalyzer.tsx** `saveToVault`:
- Change `record_type` from `"AI Analysis"` to `"Doctor's Diagnosis"` when `selectedCat` is "Doctor's Diagnosis"
- Change title to `"Doctor's Diagnosis — AI Analysis — {date}"`

**PrescriptionScanner.tsx** `SaveToVaultButton`:
- Change `record_type: "Prescription"` → `"Doctor's Diagnosis"`
- Change `title: "Prescription Analysis"` → `"Doctor's Diagnosis Analysis"`

Both components already have "Save to Medical Vault" buttons — just need the record_type and title updates.

## 4. PDF Report Generation with Share/Print

Create a shared utility: `src/lib/reportPdf.ts`

This utility will:
- Take markdown/text content + title + metadata
- Generate a styled HTML document with the app branding (navy header, formatted sections)
- Open in a new window for Print (which enables PDF save via browser)
- Provide share via WhatsApp (text summary + link) and Email (mailto with subject/body)

**Implementation approach**: Use `window.open()` with styled HTML (no external PDF library needed — browser Print-to-PDF is the most reliable approach for a web app). The HTML will have:
- Navy blue header with app name and report title
- Formatted body with sections, colored headings, tables
- Print-optimized CSS (`@media print`)
- Auto-trigger `window.print()` for PDF option

**Apply to these components**:

| Component | Current State | Change |
|-----------|--------------|--------|
| `DoctorVisitReport.tsx` | Downloads as .txt | Add PDF/Print, WhatsApp, Email buttons |
| `DocumentAnalyzer.tsx` | No download | Add PDF/Print, WhatsApp, Email buttons in results |
| `PrescriptionScanner.tsx` | No download | Add PDF/Print, WhatsApp, Email in results |
| `GuardianReports.tsx` | No export | Add "Export Report" button with PDF/Print, WhatsApp, Email |
| `VitalsMonitor.tsx` | AI insights display | Add export buttons for insights |

**Share options UI**: A dropdown or button group with:
- 🖨️ Print / Save as PDF
- 📱 Share via WhatsApp (`https://wa.me/?text=...`)
- 📧 Email (`mailto:?subject=...&body=...`)

## Files Changed

| File | Type |
|------|------|
| `src/lib/reportPdf.ts` | New — shared PDF/print/share utility |
| `src/components/health-tools/DocumentAnalyzer.tsx` | Redesign + rename + share buttons |
| `src/components/medications/PrescriptionScanner.tsx` | Rename + share buttons |
| `src/pages/MedicalVault.tsx` | Rename in RECORD_TYPES |
| `src/components/health-tools/DoctorVisitReport.tsx` | PDF/share buttons |
| `src/pages/GuardianReports.tsx` | Add export button |
| `src/components/health-tools/MedicalDocuments.tsx` | Rename if RECORD_TYPES duplicated |

## Implementation Order

1. Create `src/lib/reportPdf.ts` utility
2. Rename "Prescription" → "Doctor's Diagnosis" across all files
3. Redesign Document Analyzer with colors and aesthetics
4. Update save-to-vault record types
5. Add PDF/share/print buttons to all report components

