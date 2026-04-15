CREATE POLICY "Guardians can update own pings"
ON public.guardian_pings
FOR UPDATE
TO authenticated
USING (guardian_user_id = auth.uid());