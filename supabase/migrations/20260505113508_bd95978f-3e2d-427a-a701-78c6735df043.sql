ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check;

ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_record_type_check
  CHECK (record_type = ANY (ARRAY[
    'Doctor''s Diagnosis',
    'Lab Report',
    'Discharge Summary',
    'X-Ray / Scan',
    'Insurance Document',
    'Vaccination Record',
    'Legal Will',
    'Visual Check',
    'Hospital Bill',
    'Other'
  ]));