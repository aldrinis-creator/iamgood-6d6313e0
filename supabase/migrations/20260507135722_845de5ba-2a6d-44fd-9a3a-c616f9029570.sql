
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_by uuid;
UPDATE public.appointments SET created_by = user_id WHERE created_by IS NULL;

CREATE POLICY "Guardians can update ward appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.guardians g
  WHERE g.guardian_user_id = auth.uid()
    AND g.user_id = appointments.user_id
    AND g.status = 'accepted'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.guardians g
  WHERE g.guardian_user_id = auth.uid()
    AND g.user_id = appointments.user_id
    AND g.status = 'accepted'
));

CREATE POLICY "Guardians can delete ward appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.guardians g
  WHERE g.guardian_user_id = auth.uid()
    AND g.user_id = appointments.user_id
    AND g.status = 'accepted'
));
