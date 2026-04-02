
-- Add DELETE policy for users to delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Add DELETE policy for guardians to delete notifications about their wards
CREATE POLICY "Guardians can delete their notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (guardian_id IN (
  SELECT g.id FROM guardians g
  WHERE g.guardian_user_id = auth.uid()
    OR g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
));
