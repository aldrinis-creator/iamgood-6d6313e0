
-- 1. OTP events: add service-role-only policies
CREATE POLICY "Service role can manage otp_events" ON public.otp_events
FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. SOS events: fix guardian policy
DROP POLICY IF EXISTS "Guardians can view ward SOS events" ON public.sos_events;
CREATE POLICY "Guardians can view ward SOS events" ON public.sos_events
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = sos_events.user_id AND g.status = 'accepted'));

-- 3. Care journal: add user INSERT policy
CREATE POLICY "Users can insert own care journal" ON public.care_journal
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
