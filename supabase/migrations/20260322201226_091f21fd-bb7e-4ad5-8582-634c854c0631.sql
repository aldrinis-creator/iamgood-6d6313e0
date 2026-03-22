-- New table for public emergency profile sharing tokens
CREATE TABLE public.emergency_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_share_tokens ENABLE ROW LEVEL SECURITY;

-- Owner CRUD
CREATE POLICY "Users can manage own token" ON public.emergency_share_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public read for active tokens (used by the public emergency profile page)
CREATE POLICY "Anyone can read active tokens" ON public.emergency_share_tokens
  FOR SELECT TO anon USING (is_active = true);

-- Anon SELECT on profiles for users with active share tokens
CREATE POLICY "Anon can read profiles with active share token" ON public.profiles
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.emergency_share_tokens est
    WHERE est.user_id = profiles.id AND est.is_active = true
  ));

-- Anon SELECT on health_profile for users with active share tokens
CREATE POLICY "Anon can read health_profile with active share token" ON public.health_profile
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.emergency_share_tokens est
    WHERE est.user_id = health_profile.user_id AND est.is_active = true
  ));

-- Anon SELECT on medications for users with active share tokens
CREATE POLICY "Anon can read medications with active share token" ON public.medications
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.emergency_share_tokens est
    WHERE est.user_id = medications.user_id AND est.is_active = true
  ));

-- Anon SELECT on guardians for users with active share tokens
CREATE POLICY "Anon can read guardians with active share token" ON public.guardians
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.emergency_share_tokens est
    WHERE est.user_id = guardians.user_id AND est.is_active = true
  ));