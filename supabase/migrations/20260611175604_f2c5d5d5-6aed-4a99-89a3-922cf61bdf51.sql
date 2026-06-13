
-- 1. Blood group on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blood_group text
  CHECK (blood_group IS NULL OR blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-'));

-- 2. Blood banks directory
CREATE TABLE IF NOT EXISTS public.blood_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_sno integer,
  name text NOT NULL,
  address text,
  district text,
  state text,
  category text,
  phone text,
  email text,
  lat double precision,
  lng double precision,
  geocode_status text NOT NULL DEFAULT 'pending'
    CHECK (geocode_status IN ('pending','ok','centroid','failed')),
  geocoded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blood_banks TO authenticated, anon;
GRANT ALL ON public.blood_banks TO service_role;

ALTER TABLE public.blood_banks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read blood banks" ON public.blood_banks;
CREATE POLICY "Anyone can read blood banks"
  ON public.blood_banks FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_blood_banks_state_district
  ON public.blood_banks (state, district);
CREATE INDEX IF NOT EXISTS idx_blood_banks_latlng
  ON public.blood_banks (lat, lng);
CREATE INDEX IF NOT EXISTS idx_blood_banks_geocode_status
  ON public.blood_banks (geocode_status);

CREATE TRIGGER trg_blood_banks_updated_at
  BEFORE UPDATE ON public.blood_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
