
ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check;

ALTER TABLE public.medical_records
  ADD CONSTRAINT medical_records_record_type_check CHECK (
    record_type = ANY (ARRAY[
      'Doctor''s Diagnosis'::text,
      'Lab Report'::text,
      'Discharge Summary'::text,
      'X-Ray / Scan'::text,
      'Insurance Document'::text,
      'Vaccination Record'::text,
      'Legal Will'::text,
      'Visual Check'::text,
      'Hospital Bill'::text,
      'Other'::text,
      'ID - Aadhaar'::text,
      'ID - PAN'::text,
      'ID - Photo'::text,
      'Insurance - Primary'::text,
      'Insurance - Secondary'::text
    ])
  );

-- Backfill: insert rows for any storage objects under {user}/slots/* that
-- have no matching medical_records row. Uses storage.objects metadata.
INSERT INTO public.medical_records (user_id, title, record_type, record_slot, file_url, file_name, record_date)
SELECT
  (split_part(o.name, '/', 1))::uuid AS user_id,
  CASE s.slot
    WHEN 'aadhaar' THEN 'Aadhaar Card'
    WHEN 'pan' THEN 'PAN Card'
    WHEN 'insurance_primary' THEN 'Health Insurance — Primary'
    WHEN 'insurance_secondary' THEN 'Health Insurance — Secondary'
    WHEN 'id_photo' THEN 'Passport Photo'
  END AS title,
  CASE s.slot
    WHEN 'aadhaar' THEN 'ID - Aadhaar'
    WHEN 'pan' THEN 'ID - PAN'
    WHEN 'insurance_primary' THEN 'Insurance - Primary'
    WHEN 'insurance_secondary' THEN 'Insurance - Secondary'
    WHEN 'id_photo' THEN 'ID - Photo'
  END AS record_type,
  s.slot AS record_slot,
  o.name AS file_url,
  split_part(o.name, '/', 3) AS file_name,
  CURRENT_DATE AS record_date
FROM storage.objects o
CROSS JOIN LATERAL (
  SELECT (regexp_match(split_part(o.name, '/', 3), '^([a-z_]+)-\d+\.'))[1] AS slot
) s
WHERE o.bucket_id = 'medical-documents'
  AND o.name LIKE '%/slots/%'
  AND s.slot IN ('aadhaar','pan','insurance_primary','insurance_secondary','id_photo')
  AND NOT EXISTS (
    SELECT 1 FROM public.medical_records mr
    WHERE mr.user_id = (split_part(o.name, '/', 1))::uuid
      AND mr.record_slot = s.slot
  )
  -- Only the newest file per (user, slot)
  AND o.created_at = (
    SELECT MAX(o2.created_at) FROM storage.objects o2
    WHERE o2.bucket_id = 'medical-documents'
      AND split_part(o2.name, '/', 1) = split_part(o.name, '/', 1)
      AND (regexp_match(split_part(o2.name, '/', 3), '^([a-z_]+)-\d+\.'))[1] = s.slot
  );
