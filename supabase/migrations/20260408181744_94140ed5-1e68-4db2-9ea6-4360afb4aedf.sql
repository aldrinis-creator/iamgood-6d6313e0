
-- Create safe_zones table
CREATE TABLE public.safe_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 500,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;

-- Users can manage their own zones
CREATE POLICY "Users can view own safe zones"
  ON public.safe_zones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own safe zones"
  ON public.safe_zones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own safe zones"
  ON public.safe_zones FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own safe zones"
  ON public.safe_zones FOR DELETE
  USING (auth.uid() = user_id);

-- Guardians can view their ward's safe zones
CREATE POLICY "Guardians can view ward safe zones"
  ON public.safe_zones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.guardian_user_id = auth.uid()
        AND g.user_id = safe_zones.user_id
        AND g.status = 'accepted'
    )
  );

-- Auto-update timestamp trigger
CREATE TRIGGER update_safe_zones_updated_at
  BEFORE UPDATE ON public.safe_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
