CREATE TABLE public.journey_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  origin_name text,
  destination_name text NOT NULL,
  transport_mode text,
  total_distance_m numeric NOT NULL DEFAULT 0,
  total_duration_min numeric NOT NULL DEFAULT 0,
  break_duration_min numeric NOT NULL DEFAULT 0,
  deviation_count integer NOT NULL DEFAULT 0,
  max_deviation_m numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own journey_reports" ON public.journey_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journey_reports" ON public.journey_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Guardians can view ward journey_reports" ON public.journey_reports
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = journey_reports.user_id)
  );