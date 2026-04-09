CREATE TABLE public.health_passport_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  overall integer NOT NULL DEFAULT 0,
  checkin integer NOT NULL DEFAULT 0,
  activity integer NOT NULL DEFAULT 0,
  wellness integer NOT NULL DEFAULT 0,
  medications integer NOT NULL DEFAULT 0,
  vitals integer NOT NULL DEFAULT 0,
  nutrition integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_date)
);

ALTER TABLE public.health_passport_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scores"
  ON public.health_passport_scores FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Guardians can view ward scores"
  ON public.health_passport_scores FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.guardian_user_id = auth.uid()
      AND g.user_id = health_passport_scores.user_id
      AND g.status = 'accepted'
  ));

CREATE INDEX idx_health_passport_scores_user_date
  ON public.health_passport_scores (user_id, score_date DESC);