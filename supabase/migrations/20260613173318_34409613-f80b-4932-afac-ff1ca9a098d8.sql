-- Restrict internal-seeds storage bucket to service_role only
CREATE POLICY "Service role manages internal-seeds" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'internal-seeds')
  WITH CHECK (bucket_id = 'internal-seeds');