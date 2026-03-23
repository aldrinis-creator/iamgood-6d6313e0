
CREATE TABLE public.ppg_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  duration_sec integer NOT NULL DEFAULT 0,
  avg_heart_rate integer,
  samples jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ppg_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own ppg_sessions"
  ON public.ppg_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own ppg_sessions"
  ON public.ppg_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ppg_sessions"
  ON public.ppg_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Guardians can view ward ppg_sessions"
  ON public.ppg_sessions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
    AND g.user_id = ppg_sessions.user_id
  ));
