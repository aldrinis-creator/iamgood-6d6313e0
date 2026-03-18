
CREATE TABLE public.wellness_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  mood text NOT NULL DEFAULT 'okay',
  mood_score integer NOT NULL DEFAULT 3,
  sleep_quality integer DEFAULT 3,
  sleep_hours numeric DEFAULT 0,
  energy_level integer DEFAULT 3,
  stress_level integer DEFAULT 3,
  mindfulness_minutes integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE public.wellness_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own wellness_logs" ON public.wellness_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wellness_logs" ON public.wellness_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wellness_logs" ON public.wellness_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wellness_logs" ON public.wellness_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Guardians can view ward wellness_logs" ON public.wellness_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
    AND g.user_id = wellness_logs.user_id
  ));
