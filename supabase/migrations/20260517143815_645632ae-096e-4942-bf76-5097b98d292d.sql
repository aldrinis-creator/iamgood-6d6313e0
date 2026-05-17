-- Vault attachments bucket (private, RLS by first folder = user_id)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault-attachments', 'vault-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own vault attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vault-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own vault attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vault-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own vault attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'vault-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own vault attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vault-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);