ALTER TABLE public.otp_events ADD COLUMN IF NOT EXISTS otp_code text;
ALTER TABLE public.otp_events ADD COLUMN IF NOT EXISTS expires_at timestamptz;