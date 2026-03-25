
-- 1. Add nomination columns to guardians
ALTER TABLE public.guardians 
  ADD COLUMN IF NOT EXISTS nomination_token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS nomination_expires_at timestamptz DEFAULT (now() + interval '24 hours');

-- Change default status to pending
ALTER TABLE public.guardians ALTER COLUMN status SET DEFAULT 'pending';

-- 2. Create guardian_pings table
CREATE TABLE IF NOT EXISTS public.guardian_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_user_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guardian_pings ENABLE ROW LEVEL SECURITY;

-- Guardian can insert pings for their wards
CREATE POLICY "Guardians can insert pings for wards" ON public.guardian_pings
  FOR INSERT TO authenticated
  WITH CHECK (
    guardian_user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = guardian_pings.user_id AND g.status = 'accepted')
  );

-- Guardian can view their own pings
CREATE POLICY "Guardians can view own pings" ON public.guardian_pings
  FOR SELECT TO authenticated
  USING (guardian_user_id = auth.uid());

-- Users can view pings sent to them
CREATE POLICY "Users can view pings to them" ON public.guardian_pings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can update (mark read) pings sent to them
CREATE POLICY "Users can mark pings read" ON public.guardian_pings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime for guardian_pings
ALTER PUBLICATION supabase_realtime ADD TABLE public.guardian_pings;

-- 3. Guardian can INSERT appointments for wards
CREATE POLICY "Guardians can insert appointments for wards" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = appointments.user_id AND g.status = 'accepted')
  );

-- Guardian can SELECT ward appointments
CREATE POLICY "Guardians can view ward appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = appointments.user_id AND g.status = 'accepted')
  );

-- 4. Update ALL guardian RLS policies to also use guardian_user_id
-- We'll drop and recreate the guardian SELECT policies on each table

-- medication_logs
DROP POLICY IF EXISTS "Guardians can view ward medication_logs" ON public.medication_logs;
CREATE POLICY "Guardians can view ward medication_logs" ON public.medication_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medication_logs.user_id));

-- medical_history
DROP POLICY IF EXISTS "Guardians can view ward medical_history" ON public.medical_history;
CREATE POLICY "Guardians can view ward medical_history" ON public.medical_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medical_history.user_id));

-- user_facilities
DROP POLICY IF EXISTS "Guardians can view ward user_facilities" ON public.user_facilities;
CREATE POLICY "Guardians can view ward user_facilities" ON public.user_facilities
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = user_facilities.user_id));

-- sos_events
DROP POLICY IF EXISTS "Guardians can view ward SOS events" ON public.sos_events;
CREATE POLICY "Guardians can view ward SOS events" ON public.sos_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = sos_events.user_id));

-- care_journal - multiple policies
DROP POLICY IF EXISTS "Guardians can insert ward journal entries" ON public.care_journal;
CREATE POLICY "Guardians can insert ward journal entries" ON public.care_journal
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = care_journal.user_id));

DROP POLICY IF EXISTS "Guardians can select ward journal entries" ON public.care_journal;
CREATE POLICY "Guardians can select ward journal entries" ON public.care_journal
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = care_journal.user_id));

DROP POLICY IF EXISTS "Guardians can update ward journal entries" ON public.care_journal;
CREATE POLICY "Guardians can update ward journal entries" ON public.care_journal
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Guardians can delete ward journal entries" ON public.care_journal;
CREATE POLICY "Guardians can delete ward journal entries" ON public.care_journal
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ppg_sessions
DROP POLICY IF EXISTS "Guardians can view ward ppg_sessions" ON public.ppg_sessions;
CREATE POLICY "Guardians can view ward ppg_sessions" ON public.ppg_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = ppg_sessions.user_id));

-- health_profile
DROP POLICY IF EXISTS "Guardians can view ward health profile" ON public.health_profile;
CREATE POLICY "Guardians can view ward health profile" ON public.health_profile
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = health_profile.user_id));

-- user_settings
DROP POLICY IF EXISTS "Guardians can view ward user_settings" ON public.user_settings;
CREATE POLICY "Guardians can view ward user_settings" ON public.user_settings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = user_settings.user_id));

-- wellness_logs
DROP POLICY IF EXISTS "Guardians can view ward wellness_logs" ON public.wellness_logs;
CREATE POLICY "Guardians can view ward wellness_logs" ON public.wellness_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = wellness_logs.user_id));

-- face_scans
DROP POLICY IF EXISTS "Guardians can view ward face_scans" ON public.face_scans;
CREATE POLICY "Guardians can view ward face_scans" ON public.face_scans
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = face_scans.user_id));

-- check_ins
DROP POLICY IF EXISTS "Guardians can view ward check-ins" ON public.check_ins;
CREATE POLICY "Guardians can view ward check-ins" ON public.check_ins
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = check_ins.user_id));

-- medications
DROP POLICY IF EXISTS "Guardians can view ward medications" ON public.medications;
CREATE POLICY "Guardians can view ward medications" ON public.medications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medications.user_id));

-- activity_logs
DROP POLICY IF EXISTS "Guardians can view ward activity_logs" ON public.activity_logs;
CREATE POLICY "Guardians can view ward activity_logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = activity_logs.user_id));

-- Guardian can view ward profiles (for name, DOB, etc.)
CREATE POLICY "Guardians can view ward profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = profiles.id));

-- Guardian can view ward meal_logs
CREATE POLICY "Guardians can view ward meal_logs" ON public.meal_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = meal_logs.user_id));

-- Guardian can view ward nutrition_personas
CREATE POLICY "Guardians can view ward nutrition_personas" ON public.nutrition_personas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = nutrition_personas.user_id));

-- 5. Update link_guardian_user_id to also auto-accept expired pending nominations
CREATE OR REPLACE FUNCTION public.link_guardian_user_id()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _phone text;
BEGIN
  SELECT au.email INTO _email FROM auth.users au WHERE au.id = auth.uid();
  SELECT p.phone INTO _phone FROM profiles p WHERE p.id = auth.uid();
  
  IF _email IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE guardian_email = _email AND guardian_user_id IS NULL;
  END IF;
  
  IF _phone IS NOT NULL THEN
    UPDATE guardians SET guardian_user_id = auth.uid()
    WHERE guardian_phone = _phone AND guardian_user_id IS NULL;
  END IF;

  -- Auto-accept pending nominations past 24h window
  UPDATE guardians SET status = 'accepted'
  WHERE guardian_user_id = auth.uid()
    AND status = 'pending'
    AND nomination_expires_at <= now();
END;
$function$;
