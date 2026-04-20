-- 1. admin_2fa_config (single row holding fixed admin contacts)
CREATE TABLE public.admin_2fa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_2fa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages admin_2fa_config"
  ON public.admin_2fa_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_admin_2fa_config_updated_at
  BEFORE UPDATE ON public.admin_2fa_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. admin_2fa_codes (short-lived hashed OTPs)
CREATE TABLE public.admin_2fa_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_2fa_codes_user ON public.admin_2fa_codes(user_id, expires_at);

ALTER TABLE public.admin_2fa_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages admin_2fa_codes"
  ON public.admin_2fa_codes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. admin_step_up_tokens (30-min inactivity-window session tokens)
CREATE TABLE public.admin_step_up_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_step_up_tokens_hash ON public.admin_step_up_tokens(token_hash);

ALTER TABLE public.admin_step_up_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages admin_step_up_tokens"
  ON public.admin_step_up_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. admin_audit_log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  ip text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_user ON public.admin_audit_log(user_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages admin_audit_log"
  ON public.admin_audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Seed the fixed admin contact (idempotent — only inserts if no row exists)
INSERT INTO public.admin_2fa_config (phone, email)
SELECT '+917045868482', 'checkin_support@futurewave.in'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_2fa_config);

-- 6. Grant admin role to existing matching user (if any)
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::public.app_role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE au.email = 'checkin_support@futurewave.in'
   OR p.phone = '+917045868482'
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Trigger: auto-grant admin role on signup if matches fixed admin contact
CREATE OR REPLACE FUNCTION public.grant_admin_if_matches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_phone text;
  _admin_email text;
  _user_phone text;
  _user_email text;
BEGIN
  SELECT phone, email INTO _admin_phone, _admin_email
  FROM public.admin_2fa_config LIMIT 1;

  IF _admin_phone IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = NEW.id;
  _user_phone := NEW.phone;

  IF _user_email = _admin_email OR _user_phone = _admin_phone THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER grant_admin_role_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_if_matches();

-- 8. Cleanup function + hourly cron
CREATE OR REPLACE FUNCTION public.cleanup_admin_2fa()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_2fa_codes WHERE created_at < now() - interval '1 hour';
  DELETE FROM public.admin_step_up_tokens WHERE expires_at < now() - interval '1 hour';
END;
$$;

SELECT cron.schedule(
  'cleanup-admin-2fa',
  '0 * * * *',
  $$SELECT public.cleanup_admin_2fa();$$
);