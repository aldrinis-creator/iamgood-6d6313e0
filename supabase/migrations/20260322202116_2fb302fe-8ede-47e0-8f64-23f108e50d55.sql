
CREATE TABLE public.medical_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  reason text NOT NULL,
  nature text,
  start_date date,
  end_date date,
  treatment text,
  medications text,
  advice text,
  hospital_name text,
  doctor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own medical_history" ON public.medical_history
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Guardians can view ward medical_history" ON public.medical_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
    AND g.user_id = medical_history.user_id
  ));

CREATE POLICY "Anon can read medical_history with active share token" ON public.medical_history
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM emergency_share_tokens est
    WHERE est.user_id = medical_history.user_id AND est.is_active = true
  ));
