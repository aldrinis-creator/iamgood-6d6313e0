## Goal
Add a "Doctor Visit" section to the Guardian Reports tab (`/guardian/reports`) so guardians can view the Ward's Doctor Visit Reports.

## Scope
Read-only view of reports the Ward has already generated and saved to their Vault. Guardians do not generate new reports on the Ward's behalf.

## Changes

### 1. `src/pages/GuardianReports.tsx`
- Add new section id `doctor_visit` with label "Doctor Visit" and `Stethoscope` (or `FileText`) icon to the `sections` array.
- Add data state `doctorReports: any[]`.
- In the data-fetch `useEffect`, when `activeSection === "doctor_visit"`:
  ```ts
  supabase.from("medical_records")
    .select("id, title, description, record_date, created_at")
    .eq("user_id", wardUserId)
    .eq("record_type", "Doctor's Diagnosis")
    .order("record_date", { ascending: false })
    .limit(20)
  ```
- Render a new block that lists each report as a `Card`:
  - Title + date (formatted)
  - Expand/collapse to show the report body via `ReactMarkdown` (reuse `VisualHealthReport` + `tryParseVisualReport` like the user-side component does, for parity).
  - Per-report `ReportShareButtons` (PDF/share) using the report's `description` as content.
- Empty state: "No Doctor Visit Reports yet" card.

### 2. Access control
Restrict the section to the Primary Guardian (consistent with the Hospital Kit decision):
- Use existing `useIsPrimaryGuardian(wardUserId)` hook.
- If not primary: hide the `doctor_visit` badge from `sections` and short-circuit the panel with a "Primary Guardian only" message if the URL is hit directly.

### 3. No new edge functions, no schema changes
- RLS for `medical_records` already allows accepted guardians to read the ward's records (verify in `is_accepted_guardian_of` policy chain during implementation; if missing, plan will add a SELECT policy — but expectation is it already exists since other Guardian tabs read it).

## Out of scope
- Generating a new Doctor Visit Report from the Guardian app (kept user-only to avoid duplicate AI cost and ensure the Ward owns their narrative).
- Editing/deleting reports from the Guardian side.
- Re-adding the Doctor Visit attachment to the Hospital Emergency Kit (explicitly removed earlier).

## Verification
- Login as Primary Guardian → Reports → Doctor Visit tab shows saved reports; non-primary guardians don't see the tab.
- Empty state renders when ward has no reports.
- PDF share works per report.
