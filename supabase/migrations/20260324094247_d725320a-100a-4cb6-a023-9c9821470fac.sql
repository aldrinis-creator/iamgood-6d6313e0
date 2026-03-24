ALTER TABLE public.activity_logs 
  ADD COLUMN IF NOT EXISTS respiration_rate integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bp_systolic integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bp_diastolic integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS temperature_c numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS glucose_mg_dl integer DEFAULT NULL;