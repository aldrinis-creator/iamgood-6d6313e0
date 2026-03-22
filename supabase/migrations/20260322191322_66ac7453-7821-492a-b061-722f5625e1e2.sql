CREATE POLICY "Guardians can view ward user_settings"
ON public.user_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM guardians g
    WHERE g.guardian_phone IN (
      SELECT p.phone FROM profiles p WHERE p.id = auth.uid()
    )
    AND g.user_id = user_settings.user_id
  )
);