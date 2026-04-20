-- Admin credentials table (maps admin_id -> auth user)
CREATE TABLE public.admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- No policies = service_role only access (RLS denies all to anon/authenticated)

-- Admin login attempts (for IP rate limiting)
CREATE TABLE public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text,
  ip text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_login_attempts_ip_created ON public.admin_login_attempts(ip, created_at DESC);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- No policies = service_role only access