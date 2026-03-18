
CREATE TABLE public.face_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  heart_rate integer NOT NULL,
  stress_level text NOT NULL,
  stress_score integer NOT NULL,
  confidence text NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.face_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own face_scans"
  ON public.face_scans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own face_scans"
  ON public.face_scans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own face_scans"
  ON public.face_scans FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
