-- Add unique constraint on phone (allow nulls, but each non-null phone must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;