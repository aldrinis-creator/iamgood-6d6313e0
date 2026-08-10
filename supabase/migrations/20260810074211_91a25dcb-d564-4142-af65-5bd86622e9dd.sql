-- 1) Admission kits: require accepted guardian-ward relationship
DROP POLICY IF EXISTS "Guardians manage own admission kits" ON storage.objects;

CREATE POLICY "Guardians manage own admission kits"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'admission-kits'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    (substring(storage.filename(name) from '^[0-9a-fA-F-]{36}'))::uuid = auth.uid()
    OR public.is_accepted_guardian_of((substring(storage.filename(name) from '^[0-9a-fA-F-]{36}'))::uuid)
  )
)
WITH CHECK (
  bucket_id = 'admission-kits'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    (substring(storage.filename(name) from '^[0-9a-fA-F-]{36}'))::uuid = auth.uid()
    OR public.is_accepted_guardian_of((substring(storage.filename(name) from '^[0-9a-fA-F-]{36}'))::uuid)
  )
);

-- 2) Notifications: remove unverified phone-based guardian matching
DROP POLICY IF EXISTS "Guardians can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Guardians can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Guardians can delete their notifications" ON public.notifications;

CREATE POLICY "Guardians can view their notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  guardian_id IN (
    SELECT g.id FROM public.guardians g
    WHERE g.guardian_user_id = auth.uid() AND g.status = 'accepted'
  )
);

CREATE POLICY "Guardians can update their notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  guardian_id IN (
    SELECT g.id FROM public.guardians g
    WHERE g.guardian_user_id = auth.uid() AND g.status = 'accepted'
  )
)
WITH CHECK (
  guardian_id IN (
    SELECT g.id FROM public.guardians g
    WHERE g.guardian_user_id = auth.uid() AND g.status = 'accepted'
  )
);

CREATE POLICY "Guardians can delete their notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  guardian_id IN (
    SELECT g.id FROM public.guardians g
    WHERE g.guardian_user_id = auth.uid() AND g.status = 'accepted'
  )
);