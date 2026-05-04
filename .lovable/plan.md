# Hospital Bill Analyzer

A new AI-powered tool under **My Health → Health Tools** that lets the user upload a hospital/diagnostic bill (photo, PDF, or pasted text) and returns a structured analysis covering duplicates, overcharging, missing details, and overall fairness.

## What the user sees

A new sub-tool card **"Hospital Bill Analyzer"** alongside Doctor Visit Report, Document Analyzer, Symptom Checker, etc.

Flow:
1. Upload bill (photo / PDF / DOCX) — same uploader pattern as `DocumentAnalyzer`.
2. Optional inputs: Hospital name, City, Bill date, Admission days (helps benchmarking).
3. AI analyses and returns a structured **Bill Health Report** with sections:
   - **Summary** — total billed, AI-estimated fair range, overall verdict (Fair / Slightly High / Significantly High / Suspicious).
   - **Duplicate / Repeated charges** — same item billed multiple times (e.g. consultation x3, same investigation twice).
   - **Pricing flags** — line items priced significantly above typical Indian market / CGHS / PMJAY rates, with the typical range shown.
   - **Bundled / unbundled charges** — items normally included in room rent or package charged separately (gloves, syringes, biomedical waste, etc.).
   - **Missing details** — line items lacking unit price, quantity, GST breakup, HSN, doctor name.
   - **Category breakdown** — Room, Investigations, Pharmacy, Consumables, Doctor fees, Procedure, Misc — with % of total.
   - **Questions to ask the hospital** — 3-6 specific, polite questions the user/family can raise at billing desk.
   - **Disclaimer** — not legal/medical advice; rates are indicative; verify with hospital.

PDF share/download via existing `ReportShareButtons`.

## Where it lives

- New component: `src/components/health-tools/HospitalBillAnalyzer.tsx` (modeled on `DocumentAnalyzer.tsx` — same upload, PDF/DOCX text extraction, image base64 fallback, progress steps, save-to-vault).
- Registered in `src/pages/MyHealth.tsx`:
  - Add `{ icon: Receipt, label: "Hospital Bill Analyzer", desc: "Check bill for duplicates, overcharging" }` to `healthToolsSubItems`.
  - Add `"Hospital Bill Analyzer": HospitalBillAnalyzer` to `subToolComponents`.
- Available to both **user** and **guardian** roles (guardians often handle bills).

## Backend

Extend existing `supabase/functions/health-tools/index.ts` with a new prompt key `hospital_bill_analysis`:
- Input: extracted bill text (or image for vision models), plus optional hospital/city/days context.
- Model: `google/gemini-3-flash-preview` for text bills; `google/gemini-2.5-pro` when only image is available (better OCR + reasoning on tabular bills).
- Output: strict JSON schema via tool calling so the UI can render it deterministically:
  ```
  {
    summary: { total_billed, currency, fair_range_min, fair_range_max, verdict, verdict_reason },
    duplicates: [{ item, times_billed, suspected_reason }],
    pricing_flags: [{ item, billed_amount, typical_range, severity }],
    bundling_flags: [{ item, note }],
    missing_details: [{ item, missing_fields[] }],
    category_breakdown: [{ category, amount, percent }],
    questions_to_ask: [string],
    disclaimer: string
  }
  ```
- Prompt anchors AI to **Indian context**: CGHS rates, PMJAY package rates, typical private/corporate hospital ranges, GST rules on healthcare (exempt vs taxable consumables).

## Save & history

- Reuse existing `encrypted_documents` save flow from `DocumentAnalyzer` so the analysis can be stored in the user's Medical Vault under a new category label `Hospital Bill`. No DB migration needed — uses existing table and free-form category string.

## Privacy & safety

- All processing via existing Lovable AI gateway (no new secrets).
- AI output explicitly framed as **indicative**, not authoritative; verdict copy avoids accusatory language ("possibly duplicated", "above typical range" — never "fraud").
- Disclaimer always rendered at the bottom of the report and included in the PDF export.

## Out of scope (not building now)

- Guardian alerts / notifications when ward uploads a bill — can add later if useful.
- Auto-comparison across multiple bills / hospitals — needs a benchmark dataset.
- Insurance claim pre-fill — separate workflow.

## Effort

Roughly one component (~400 lines, copy-adapted from `DocumentAnalyzer`), one new prompt + JSON schema in the existing edge function, two small edits in `MyHealth.tsx`. No DB migration, no new secrets, no new dependencies.
