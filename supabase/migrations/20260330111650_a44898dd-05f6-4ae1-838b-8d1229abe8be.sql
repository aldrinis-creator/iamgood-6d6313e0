ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check;
ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_record_type_check
  CHECK (record_type IN (
    'prescription', 'lab_report', 'discharge_summary', 'insurance',
    'id_card', 'vaccination', 'other',
    'Lab Report', 'Doctor''s Diagnosis', 'Discharge Summary',
    'X-Ray / Scan', 'Insurance', 'Insurance Document',
    'Vaccination Record', 'Legal Will', 'Other',
    'Document Analysis'
  ));