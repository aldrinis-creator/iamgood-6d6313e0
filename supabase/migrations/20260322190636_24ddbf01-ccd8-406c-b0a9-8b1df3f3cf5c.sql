CREATE POLICY "Users can insert notifications for their guardians"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);