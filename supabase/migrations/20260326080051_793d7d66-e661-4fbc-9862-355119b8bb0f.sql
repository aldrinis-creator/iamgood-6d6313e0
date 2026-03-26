
-- Allow guardians to UPDATE sos_events for their wards (to resolve stale alerts)
CREATE POLICY "Guardians can update ward SOS events"
ON public.sos_events
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM guardians g
  WHERE g.guardian_user_id = auth.uid()
    AND g.user_id = sos_events.user_id
    AND g.status = 'accepted'
));

-- Allow users to INSERT into guardian_pings (for replying to guardian pings)
CREATE POLICY "Users can reply to guardian pings"
ON public.guardian_pings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
