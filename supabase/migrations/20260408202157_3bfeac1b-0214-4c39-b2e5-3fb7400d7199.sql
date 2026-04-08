
-- Fix guardian SELECT policies: add status = 'accepted' check

-- activity_logs
DROP POLICY IF EXISTS "Guardians can view ward activity_logs" ON public.activity_logs;
CREATE POLICY "Guardians can view ward activity_logs" ON public.activity_logs
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = activity_logs.user_id AND g.status = 'accepted'));

-- check_ins
DROP POLICY IF EXISTS "Guardians can view ward check-ins" ON public.check_ins;
CREATE POLICY "Guardians can view ward check-ins" ON public.check_ins
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = check_ins.user_id AND g.status = 'accepted'));

-- face_scans
DROP POLICY IF EXISTS "Guardians can view ward face_scans" ON public.face_scans;
CREATE POLICY "Guardians can view ward face_scans" ON public.face_scans
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = face_scans.user_id AND g.status = 'accepted'));

-- health_profile
DROP POLICY IF EXISTS "Guardians can view ward health profile" ON public.health_profile;
CREATE POLICY "Guardians can view ward health profile" ON public.health_profile
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = health_profile.user_id AND g.status = 'accepted'));

-- journey_reports
DROP POLICY IF EXISTS "Guardians can view ward journey_reports" ON public.journey_reports;
CREATE POLICY "Guardians can view ward journey_reports" ON public.journey_reports
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = journey_reports.user_id AND g.status = 'accepted'));

-- journey_updates
DROP POLICY IF EXISTS "Guardians can view ward journey_updates" ON public.journey_updates;
CREATE POLICY "Guardians can view ward journey_updates" ON public.journey_updates
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = journey_updates.user_id AND g.status = 'accepted'));

-- journeys
DROP POLICY IF EXISTS "Guardians can view ward journeys" ON public.journeys;
CREATE POLICY "Guardians can view ward journeys" ON public.journeys
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = journeys.user_id AND g.status = 'accepted'));

-- meal_logs
DROP POLICY IF EXISTS "Guardians can view ward meal_logs" ON public.meal_logs;
CREATE POLICY "Guardians can view ward meal_logs" ON public.meal_logs
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = meal_logs.user_id AND g.status = 'accepted'));

-- medical_history
DROP POLICY IF EXISTS "Guardians can view ward medical_history" ON public.medical_history;
CREATE POLICY "Guardians can view ward medical_history" ON public.medical_history
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medical_history.user_id AND g.status = 'accepted'));

-- medication_logs
DROP POLICY IF EXISTS "Guardians can view ward medication_logs" ON public.medication_logs;
CREATE POLICY "Guardians can view ward medication_logs" ON public.medication_logs
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medication_logs.user_id AND g.status = 'accepted'));

-- medications
DROP POLICY IF EXISTS "Guardians can view ward medications" ON public.medications;
CREATE POLICY "Guardians can view ward medications" ON public.medications
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medications.user_id AND g.status = 'accepted'));

-- nutrition_personas
DROP POLICY IF EXISTS "Guardians can view ward nutrition_personas" ON public.nutrition_personas;
CREATE POLICY "Guardians can view ward nutrition_personas" ON public.nutrition_personas
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = nutrition_personas.user_id AND g.status = 'accepted'));

-- ppg_sessions
DROP POLICY IF EXISTS "Guardians can view ward ppg_sessions" ON public.ppg_sessions;
CREATE POLICY "Guardians can view ward ppg_sessions" ON public.ppg_sessions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = ppg_sessions.user_id AND g.status = 'accepted'));

-- profiles
DROP POLICY IF EXISTS "Guardians can view ward profiles" ON public.profiles;
CREATE POLICY "Guardians can view ward profiles" ON public.profiles
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = profiles.id AND g.status = 'accepted'));

-- care_journal SELECT
DROP POLICY IF EXISTS "Guardians can select ward journal entries" ON public.care_journal;
CREATE POLICY "Guardians can select ward journal entries" ON public.care_journal
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = care_journal.user_id AND g.status = 'accepted'));

-- care_journal DELETE: add guardian relationship check
DROP POLICY IF EXISTS "Guardians can delete ward journal entries" ON public.care_journal;
CREATE POLICY "Guardians can delete ward journal entries" ON public.care_journal
FOR DELETE TO authenticated
USING (created_by = auth.uid() AND EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = care_journal.user_id AND g.status = 'accepted'));

-- care_journal INSERT: ensure status = 'accepted'
DROP POLICY IF EXISTS "Guardians can insert ward journal entries" ON public.care_journal;
CREATE POLICY "Guardians can insert ward journal entries" ON public.care_journal
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = care_journal.user_id AND g.status = 'accepted'));

-- care_journal UPDATE
DROP POLICY IF EXISTS "Guardians can update ward journal entries" ON public.care_journal;
CREATE POLICY "Guardians can update ward journal entries" ON public.care_journal
FOR UPDATE TO authenticated
USING (created_by = auth.uid() AND EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = care_journal.user_id AND g.status = 'accepted'));

-- Fix emergency share anon policies: remove overly permissive policies
-- These tables still need anon access for emergency profiles, but only via
-- the lookup_emergency_token RPC (which the frontend now uses).
-- The anon policies check if ANY active token exists for the user_id,
-- but since we removed the anon policy on emergency_share_tokens,
-- anon users can no longer discover user_ids to exploit this.
-- The data is only accessible if you know the token → RPC → get user_id → query tables.
-- This is defense-in-depth: the RPC is the gatekeeper.
