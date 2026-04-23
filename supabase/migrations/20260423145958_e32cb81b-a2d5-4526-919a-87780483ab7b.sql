ALTER TABLE public.ambulance_requests
ADD COLUMN ambulance_type text NOT NULL DEFAULT 'BLS'
CHECK (ambulance_type IN ('BLS', 'ALS'));