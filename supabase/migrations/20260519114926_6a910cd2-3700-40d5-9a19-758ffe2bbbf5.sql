-- Add minimal guardian profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text;

-- Public avatars bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Avatar storage policies (user-folder scoped)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================
-- HARD DELETE all ward-style data owned by Guardian-role accounts
-- =============================================================
-- Scoped by user_roles.role = 'guardian' (server-side, RLS-bypassing via migration)

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.health_profile WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.medical_history WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.encrypted_documents WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.health_passport_scores WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.face_scans WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.activity_logs WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.meal_logs WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.medications WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.nutrition_personas WHERE user_id IN (SELECT user_id FROM guardian_ids);

WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.wellness_logs WHERE user_id IN (SELECT user_id FROM guardian_ids);

-- Sub-guardians nominated BY a guardian account (acting as if they were a ward).
-- IMPORTANT: only delete rows where the guardian account is the user_id (the "ward" side).
-- NEVER delete rows where guardian_user_id = the guardian account (those are their wardship links).
WITH guardian_ids AS (
  SELECT user_id FROM public.user_roles WHERE role = 'guardian'
)
DELETE FROM public.guardians WHERE user_id IN (SELECT user_id FROM guardian_ids);

-- Clear stale body-metric fields on the profiles row for guardian accounts
UPDATE public.profiles
SET weight_kg = NULL, height_m = NULL, date_of_birth = NULL, gender = NULL
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'guardian');