
-- Add nomination status and timestamp to guardians
ALTER TABLE public.guardians 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS nominated_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_vault_nominee boolean NOT NULL DEFAULT false;

-- Update existing guardians to accepted status
UPDATE public.guardians SET status = 'accepted' WHERE status IS NULL OR status = 'accepted';
