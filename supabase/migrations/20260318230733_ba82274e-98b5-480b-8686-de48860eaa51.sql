CREATE TABLE public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  legal_basis TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own privacy requests"
  ON public.privacy_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own privacy requests"
  ON public.privacy_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);