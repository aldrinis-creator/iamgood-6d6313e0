-- Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS height_m numeric;

-- Create encrypted_documents table
CREATE TABLE public.encrypted_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  encrypted_value text NOT NULL,
  iv text NOT NULL,
  salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, doc_type)
);

ALTER TABLE public.encrypted_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own encrypted_documents" ON public.encrypted_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own encrypted_documents" ON public.encrypted_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own encrypted_documents" ON public.encrypted_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own encrypted_documents" ON public.encrypted_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create vault_pins table
CREATE TABLE public.vault_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own vault_pin" ON public.vault_pins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vault_pin" ON public.vault_pins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vault_pin" ON public.vault_pins
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vault_pin" ON public.vault_pins
  FOR DELETE TO authenticated USING (auth.uid() = user_id);