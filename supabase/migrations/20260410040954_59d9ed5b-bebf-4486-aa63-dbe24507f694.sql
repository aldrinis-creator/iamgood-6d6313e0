
CREATE TABLE public.medication_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ordered_by uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'ordered',
  doctor_name text,
  hospital_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medication_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON public.medication_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own orders" ON public.medication_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.medication_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Guardians can insert ward orders" ON public.medication_orders FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medication_orders.user_id AND g.status = 'accepted'));
CREATE POLICY "Guardians can view ward orders" ON public.medication_orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medication_orders.user_id AND g.status = 'accepted'));
