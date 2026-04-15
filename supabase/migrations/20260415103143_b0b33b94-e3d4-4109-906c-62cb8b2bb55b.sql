
CREATE POLICY "Users can delete own pings"
ON public.guardian_pings
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Guardians can delete own pings"
ON public.guardian_pings
FOR DELETE
TO authenticated
USING (guardian_user_id = auth.uid());
