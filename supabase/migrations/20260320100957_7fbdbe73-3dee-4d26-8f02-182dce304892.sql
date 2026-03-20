
ALTER TABLE public.health_profile 
ADD COLUMN IF NOT EXISTS family_doctor_name text,
ADD COLUMN IF NOT EXISTS family_doctor_phone text;

-- Storage policies for medical-documents bucket (for ID photo uploads)
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'medical-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'medical-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'medical-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'medical-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
