
CREATE TABLE IF NOT EXISTS public.ambulance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ward_user_id uuid,
  source text NOT NULL DEFAULT 'user',
  channel text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'pending',
  patient_name text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_name text,
  destination_lat double precision,
  destination_lng double precision,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  health_summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ambulance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ambulance requests"
  ON public.ambulance_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ambulance requests"
  ON public.ambulance_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Guardians can view ward ambulance requests"
  ON public.ambulance_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.guardian_user_id = auth.uid()
        AND g.user_id = COALESCE(ambulance_requests.ward_user_id, ambulance_requests.user_id)
        AND g.status = 'accepted'
    )
  );

CREATE POLICY "Service role manages ambulance requests"
  ON public.ambulance_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_ambulance_requests_user ON public.ambulance_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ambulance_requests_ward ON public.ambulance_requests(ward_user_id, created_at DESC);

CREATE TRIGGER trg_ambulance_requests_updated_at
  BEFORE UPDATE ON public.ambulance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
