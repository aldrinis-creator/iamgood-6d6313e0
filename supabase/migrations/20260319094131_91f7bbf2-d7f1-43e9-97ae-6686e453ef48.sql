ALTER TABLE public.nutrition_personas
  ADD COLUMN IF NOT EXISTS height_m numeric NULL,
  ADD COLUMN IF NOT EXISTS date_of_birth date NULL,
  ADD COLUMN IF NOT EXISTS smoking text NULL,
  ADD COLUMN IF NOT EXISTS alcohol text NULL;