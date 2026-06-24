## Goal
Add prior-treatment continuity to the Doctor Visit Report so the doctor sees the **earliest prior diagnosis** along with timelines and a brief AI analysis of that previous visit.

## Changes

### 1. `src/components/health-tools/DoctorVisitReport.tsx`
Extend the data fetched before calling the edge function:
- Query `medical_records` for the user filtered to diagnosis-type records (`record_type in ('Doctor's Diagnosis','Diagnosis','Prescription')`), ordered by `record_date ASC limit 1` → **earliest prior diagnosis**.
- Query `medical_history` ordered by `diagnosed_date ASC nulls last, created_at ASC limit 1` as a secondary source (covers users who logged conditions there instead of as a record).
- Compute timeline metadata client-side: `earliest_date`, `days_since`, `years_since` (IST).
- Add a new `prior_diagnosis` object to the payload sent to the `health-tools` edge function:
  ```
  prior_diagnosis: {
    source: 'medical_records' | 'medical_history' | null,
    title, description, record_date | diagnosed_date,
    days_since, years_since
  }
  ```

### 2. `supabase/functions/health-tools/index.ts`
Update the `doctor_report` system prompt to add a new required section:
- **"Prior Treatment Context"** — render the earliest diagnosis with its date and elapsed time (e.g. "First documented diagnosis: Hypertension — 12 Mar 2022 (3 years 4 months ago)").
- **"AI Analysis of Prior Visit"** — a brief paragraph interpreting how that earlier diagnosis/treatment relates to the patient's current medications, vitals, and trends (progression, control, gaps, drug continuity).
- Instruct the model to omit the section gracefully ("No prior diagnosis on record") when `prior_diagnosis` is null.

No DB/schema changes, no UI changes to the Guardian Reports tab, no changes to save-to-vault flow.

## Out of scope
- Pulling the *full* history of prior diagnoses (user asked for the **earliest** one for continuity).
- Editing the visual report renderer — output stays markdown-compatible.
