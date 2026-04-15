
ALTER TABLE public.guardian_pings
ADD COLUMN initiated_by text NOT NULL DEFAULT 'guardian';
