## Fix: Hospital Bill Analyzer not saving to Medical Vault

### Root cause
The `medical_records.record_type` column has a CHECK constraint whitelist that doesn't include `'Hospital Bill'`. Every save from the Hospital Bill Analyzer is rejected by Postgres, so nothing reaches the Analyzer tab.

Current allowed values: `Doctor's Diagnosis, Lab Report, Discharge Summary, X-Ray / Scan, Insurance Document, Vaccination Record, Legal Will, Visual Check, Other`.

### Changes

**1. DB migration** — replace the CHECK constraint to add `'Hospital Bill'`:

```sql
ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check;

ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_record_type_check
  CHECK (record_type = ANY (ARRAY[
    'Doctor''s Diagnosis','Lab Report','Discharge Summary','X-Ray / Scan',
    'Insurance Document','Vaccination Record','Legal Will','Visual Check',
    'Hospital Bill','Other'
  ]));
```

**2. Frontend hardening** in `src/components/health-tools/HospitalBillAnalyzer.tsx` `saveToVault`:
- Log storage upload errors via `console.warn` instead of silently swallowing them, so future partial-save issues are visible in the console.
- Keep existing behavior of inserting the record even if some page uploads fail (analysis text is preserved).

### Out of scope
No changes to `MedicalVault.tsx` — `ANALYZER_TYPES` already contains `"Hospital Bill"`, so once the row inserts it appears under the Analyzer tab automatically.
