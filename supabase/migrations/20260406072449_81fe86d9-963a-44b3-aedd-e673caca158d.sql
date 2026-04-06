
CREATE TABLE public.otp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  action text NOT NULL DEFAULT 'send',
  request_id text,
  status text NOT NULL DEFAULT 'sent',
  failure_reason text,
  delivery_status text,
  delivery_time timestamptz,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_events_phone_created ON public.otp_events (phone, created_at DESC);
CREATE INDEX idx_otp_events_request_id ON public.otp_events (request_id);

ALTER TABLE public.otp_events ENABLE ROW LEVEL SECURITY;

-- No public access at all — only service_role can read/write
-- This prevents any user from browsing OTP logs
