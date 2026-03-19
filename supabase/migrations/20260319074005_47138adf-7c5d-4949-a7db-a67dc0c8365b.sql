-- Allow guardians to view ward's face scans
CREATE POLICY "Guardians can view ward face_scans"
ON public.face_scans FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (
      SELECT p.phone FROM profiles p WHERE p.id = auth.uid()
    )
    AND g.user_id = face_scans.user_id
  )
);

-- Allow guardians to view ward's medications
CREATE POLICY "Guardians can view ward medications"
ON public.medications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (
      SELECT p.phone FROM profiles p WHERE p.id = auth.uid()
    )
    AND g.user_id = medications.user_id
  )
);

-- Allow guardians to view ward's medication logs
CREATE POLICY "Guardians can view ward medication_logs"
ON public.medication_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (
      SELECT p.phone FROM profiles p WHERE p.id = auth.uid()
    )
    AND g.user_id = medication_logs.user_id
  )
);