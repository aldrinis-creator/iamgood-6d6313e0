ALTER TABLE public.activity_logs
  ADD COLUMN heart_rate integer DEFAULT 0,
  ADD COLUMN distance_km numeric DEFAULT 0,
  ADD COLUMN cadence integer DEFAULT 0,
  ADD COLUMN calories integer DEFAULT 0,
  ADD COLUMN active_minutes integer DEFAULT 0,
  ADD COLUMN breaths_per_min integer DEFAULT 0,
  ADD COLUMN floors_climbed integer DEFAULT 0,
  ADD COLUMN spo2 numeric DEFAULT 0;