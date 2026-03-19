ALTER TABLE public.nutrition_personas
  ADD COLUMN IF NOT EXISTS activity_level text,
  ADD COLUMN IF NOT EXISTS medical_conditions text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dietary_preferences text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS blood_group text;