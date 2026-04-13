
-- Delete duplicate guardian rows, keeping the earliest per (user_id, guardian_phone)
DELETE FROM public.guardians
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, guardian_phone) id
  FROM public.guardians
  ORDER BY user_id, guardian_phone, created_at ASC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.guardians
ADD CONSTRAINT guardians_user_id_guardian_phone_unique UNIQUE (user_id, guardian_phone);
