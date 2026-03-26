
-- Create journeys table
CREATE TABLE public.journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  destination_name text NOT NULL,
  destination_lat double precision NOT NULL,
  destination_lng double precision NOT NULL,
  origin_name text,
  origin_lat double precision,
  origin_lng double precision,
  transport_mode text DEFAULT 'car',
  estimated_duration_min integer,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own journeys" ON public.journeys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select own journeys" ON public.journeys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own journeys" ON public.journeys FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journeys" ON public.journeys FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Guardians can view ward journeys" ON public.journeys FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = journeys.user_id)
);

-- Create journey_updates table
CREATE TABLE public.journey_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lat double precision,
  lng double precision,
  check_in_response text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own journey_updates" ON public.journey_updates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select own journey_updates" ON public.journey_updates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Guardians can view ward journey_updates" ON public.journey_updates FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = journey_updates.user_id)
);

-- Enable realtime for journey_updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.journey_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.journeys;
