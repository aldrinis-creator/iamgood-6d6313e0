-- 1. Token-gated emergency profile: single security-definer RPC that requires the
-- actual share token. Anon table-level reads are removed entirely.
CREATE OR REPLACE FUNCTION public.get_emergency_profile(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
  _result jsonb;
  _last24h timestamptz := now() - interval '24 hours';
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT est.user_id INTO _uid
  FROM public.emergency_share_tokens est
  WHERE est.token = _token AND est.is_active = true
  LIMIT 1;

  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'profile', (
      SELECT to_jsonb(x) FROM (
        SELECT p.full_name, p.date_of_birth, p.gender, p.phone
        FROM public.profiles p WHERE p.id = _uid
      ) x
    ),
    'health', (
      SELECT to_jsonb(x) FROM (
        SELECT hp.blood_group, hp.allergies, hp.chronic_conditions, hp.emergency_notes,
               hp.family_doctor_name, hp.family_doctor_phone
        FROM public.health_profile hp WHERE hp.user_id = _uid
      ) x
    ),
    'medications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', m.name, 'dosage', m.dosage))
      FROM public.medications m WHERE m.user_id = _uid
    ), '[]'::jsonb),
    'guardians', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'guardian_name', g.guardian_name, 'guardian_phone', g.guardian_phone,
        'relation', g.relation, 'is_primary', g.is_primary) ORDER BY g.is_primary DESC)
      FROM public.guardians g WHERE g.user_id = _uid AND g.status = 'accepted'
    ), '[]'::jsonb),
    'medical_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'type', mh.type, 'reason', mh.reason, 'hospital_name', mh.hospital_name,
        'doctor_name', mh.doctor_name, 'start_date', mh.start_date,
        'end_date', mh.end_date, 'treatment', mh.treatment) ORDER BY mh.start_date DESC)
      FROM public.medical_history mh WHERE mh.user_id = _uid
    ), '[]'::jsonb),
    'recent_meds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', md.name, 'dosage', md.dosage, 'taken_at', ml.taken_at) ORDER BY ml.taken_at DESC)
      FROM public.medication_logs ml
      LEFT JOIN public.medications md ON md.id = ml.medication_id
      WHERE ml.user_id = _uid
        AND ml.scheduled_at >= _last24h
        AND ml.status IN ('taken', 'taken_late')
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_emergency_profile(text) TO anon, authenticated;

-- Remove the anon table policies that leaked data without the token
DROP POLICY IF EXISTS "Anon can read profiles with active share token" ON public.profiles;
DROP POLICY IF EXISTS "Anon can read medications with active share token" ON public.medications;
DROP POLICY IF EXISTS "Anon can read medical_history with active share token" ON public.medical_history;
DROP POLICY IF EXISTS "Anon can read health_profile with active share token" ON public.health_profile;

REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.medications FROM anon;
REVOKE SELECT ON public.medical_history FROM anon;
REVOKE SELECT ON public.health_profile FROM anon;

-- 2. Lock the deceased-user cancel policy to status='cancelled' only, and prevent
-- tampering with the claim's other sensitive fields.
DROP POLICY IF EXISTS "Deceased user cancels own claim" ON public.vault_nominee_claims;
CREATE POLICY "Deceased user cancels own claim"
ON public.vault_nominee_claims
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status IN ('initiated', 'docs_uploaded', 'user_window_open'))
WITH CHECK (
  auth.uid() = user_id
  AND status = 'cancelled'
  AND public.vault_claim_keys_unchanged(id, user_id, guardian_id)
);