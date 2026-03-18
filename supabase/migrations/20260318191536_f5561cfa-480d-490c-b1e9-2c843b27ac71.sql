
-- Storage RLS policies for medical-documents bucket
-- Users can upload files to their own folder (user_id as folder name)
CREATE POLICY "Users can upload their own medical documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'medical-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own medical documents
CREATE POLICY "Users can view their own medical documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'medical-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own medical documents
CREATE POLICY "Users can delete their own medical documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'medical-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own medical documents
CREATE POLICY "Users can update their own medical documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'medical-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
