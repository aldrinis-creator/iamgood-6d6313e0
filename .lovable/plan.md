

# Fix: medical_records record_type check constraint mismatch

## Problem
The `medical_records` table has a CHECK constraint limiting `record_type` to: `prescription`, `lab_report`, `discharge_summary`, `insurance`, `id_card`, `vaccination`, `other`.

But the UI code sends display-friendly values like `"Lab Report"`, `"Doctor's Diagnosis"`, `"X-Ray / Scan"`, `"Insurance"`, etc. — which violate the constraint.

## Solution
Two changes needed:

### 1. Database migration — update the CHECK constraint
Drop the old constraint and add a new one that includes all record types used across the app (using the display-friendly names consistently, since "Doctor's Diagnosis" replaced "Prescription" per project conventions):

```sql
ALTER TABLE public.medical_records DROP CONSTRAINT medical_records_record_type_check;
ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_record_type_check
  CHECK (record_type IN (
    'prescription', 'lab_report', 'discharge_summary', 'insurance',
    'id_card', 'vaccination', 'other',
    'Lab Report', 'Doctor''s Diagnosis', 'Discharge Summary',
    'X-Ray / Scan', 'Insurance', 'Insurance Document',
    'Vaccination Record', 'Legal Will', 'Other',
    'Document Analysis'
  ));
```

This preserves backward compatibility with any existing rows using the old snake_case values while allowing all new UI values.

### 2. No code changes needed
The UI code is already consistent in what it sends. The constraint just needs to accept those values.

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | Drop + recreate the `medical_records_record_type_check` constraint to accept all UI record type values |

