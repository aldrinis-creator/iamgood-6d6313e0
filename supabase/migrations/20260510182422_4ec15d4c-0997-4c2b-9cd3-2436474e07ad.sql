-- Add record_slot to medical_records for fixed-slot ID/insurance documents
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS record_slot text;

CREATE UNIQUE INDEX IF NOT EXISTS medical_records_user_slot_unique
  ON public.medical_records (user_id, record_slot)
  WHERE record_slot IS NOT NULL;

-- Allow guardians to read ward medical_records (needed for Hospital Visit tab)
DROP POLICY IF EXISTS "Guardians can view ward medical_records" ON public.medical_records;
CREATE POLICY "Guardians can view ward medical_records"
ON public.medical_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.guardian_user_id = auth.uid()
      AND g.user_id = medical_records.user_id
      AND g.status = 'accepted'
  )
);

-- Allow guardians to read ward medical-documents storage objects (needed for signed URLs / preview)
DROP POLICY IF EXISTS "Guardians can read ward medical documents" ON storage.objects;
CREATE POLICY "Guardians can read ward medical documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.guardian_user_id = auth.uid()
      AND g.user_id::text = (storage.foldername(name))[1]
      AND g.status = 'accepted'
  )
);

-- Private bucket for generated admission kit PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('admission-kits', 'admission-kits', false)
ON CONFLICT (id) DO NOTHING;

-- Guardians can manage their own admission-kit files (path prefix = guardian uid)
DROP POLICY IF EXISTS "Guardians manage own admission kits" ON storage.objects;
CREATE POLICY "Guardians manage own admission kits"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'admission-kits'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'admission-kits'
  AND auth.uid()::text = (storage.foldername(name))[1]
);