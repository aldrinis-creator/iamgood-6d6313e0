CREATE TABLE public.vitals_retention_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purge_date date NOT NULL,
  stage text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, purge_date, stage)
);
GRANT SELECT ON public.vitals_retention_notices TO authenticated;
GRANT ALL ON public.vitals_retention_notices TO service_role;
ALTER TABLE public.vitals_retention_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own retention notices" ON public.vitals_retention_notices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);