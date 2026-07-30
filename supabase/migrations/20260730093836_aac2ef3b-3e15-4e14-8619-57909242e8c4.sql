DROP POLICY IF EXISTS "Users can update their own guardians" ON public.guardians;
CREATE POLICY "Users can update their own guardians"
ON public.guardians
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);