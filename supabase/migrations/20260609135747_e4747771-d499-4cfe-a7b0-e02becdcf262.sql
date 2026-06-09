
CREATE TYPE public.healthcare_expense_category AS ENUM (
  'medication','doctor_fees','insurance','diagnostics','equipment_caregiving','other'
);
CREATE TYPE public.healthcare_expense_source AS ENUM ('manual','voice','bill_scan');

CREATE TABLE public.healthcare_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  category public.healthcare_expense_category NOT NULL DEFAULT 'other',
  merchant text,
  expense_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  notes text,
  source public.healthcare_expense_source NOT NULL DEFAULT 'manual',
  bill_image_path text,
  ai_extracted jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX healthcare_expenses_user_date_idx
  ON public.healthcare_expenses (user_id, expense_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.healthcare_expenses TO authenticated;
GRANT ALL ON public.healthcare_expenses TO service_role;

ALTER TABLE public.healthcare_expenses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_accepted_guardian_of(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.user_id = _user_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
  );
$$;

CREATE POLICY "Own or guardian read"
  ON public.healthcare_expenses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_accepted_guardian_of(user_id));

CREATE POLICY "Own or guardian insert"
  ON public.healthcare_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (user_id = auth.uid() OR public.is_accepted_guardian_of(user_id))
  );

CREATE POLICY "Owner update"
  ON public.healthcare_expenses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Owner delete"
  ON public.healthcare_expenses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid());

CREATE TRIGGER trg_healthcare_expenses_updated_at
  BEFORE UPDATE ON public.healthcare_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies (bucket already created via storage tool)
CREATE POLICY "healthcare-bills owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'healthcare-bills'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "healthcare-bills owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'healthcare-bills'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "healthcare-bills owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'healthcare-bills'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "healthcare-bills owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'healthcare-bills'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
