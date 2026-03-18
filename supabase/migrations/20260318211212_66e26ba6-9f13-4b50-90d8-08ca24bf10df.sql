CREATE POLICY "Guardians can view ward activity_logs"
ON public.activity_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
    AND g.user_id = activity_logs.user_id
  )
);