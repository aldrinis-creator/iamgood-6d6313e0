-- Replace the record_type check constraint to include "Visual Check"
ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check;

ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_record_type_check
CHECK (record_type IN (
  'Doctor''s Diagnosis',
  'Lab Report',
  'Discharge Summary',
  'X-Ray / Scan',
  'Insurance Document',
  'Vaccination Record',
  'Legal Will',
  'Visual Check',
  'Other'
));

-- Now migrate existing visual screening records
UPDATE public.medical_records
SET record_type = 'Visual Check'
WHERE record_type = 'Lab Report'
  AND (
    title LIKE 'Tongue Check%'
    OR title LIKE 'Urine Color Check%'
    OR title LIKE 'Urine Dipstick%'
    OR title LIKE 'Urine Check%'
    OR title LIKE 'Face Scan%'
  );