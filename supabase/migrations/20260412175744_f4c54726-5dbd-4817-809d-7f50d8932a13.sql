ALTER TABLE public.medical_records DROP CONSTRAINT medical_records_record_type_check;

ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_record_type_check CHECK (record_type = ANY (ARRAY[
  'prescription'::text, 'lab_report'::text, 'discharge_summary'::text, 'insurance'::text, 'id_card'::text, 'vaccination'::text, 'other'::text,
  'Lab Report'::text, 'Doctor''s Diagnosis'::text, 'Discharge Summary'::text, 'X-Ray / Scan'::text, 'Insurance'::text, 'Insurance Document'::text, 'Vaccination Record'::text, 'Legal Will'::text, 'Other'::text, 'Document Analysis'::text,
  'AI Analysis'::text
]));