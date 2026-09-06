CREATE TABLE public.zone_exit_declines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  zone_id uuid,
  zone_name text,
  lat double precision,
  lng double precision,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.zone_exit_declines TO authenticated;
GRANT ALL ON public.zone_exit_declines TO service_role;

ALTER TABLE public.zone_exit_declines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can record their own declines"
ON public.zone_exit_declines
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_zone_exit_declines_created_at ON public.zone_exit_declines (created_at);