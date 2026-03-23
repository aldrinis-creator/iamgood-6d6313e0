
CREATE TABLE public.user_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  facility_type text NOT NULL,
  name text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own user_facilities"
  ON public.user_facilities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own user_facilities"
  ON public.user_facilities FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own user_facilities"
  ON public.user_facilities FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_facilities"
  ON public.user_facilities FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Guardians can view ward user_facilities"
  ON public.user_facilities FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
    AND g.user_id = user_facilities.user_id
  ));
