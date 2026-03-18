-- Medications catalog
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  dosage text NOT NULL DEFAULT '1 tablet',
  frequency text NOT NULL DEFAULT 'once_daily',
  instructions text,
  total_quantity int NOT NULL DEFAULT 30,
  remaining_quantity int NOT NULL DEFAULT 30,
  low_stock_threshold int NOT NULL DEFAULT 5,
  refill_reminder boolean NOT NULL DEFAULT true,
  alarm_enabled boolean NOT NULL DEFAULT true,
  alarm_mode text NOT NULL DEFAULT 'chime',
  schedule_times text[] NOT NULL DEFAULT '{"08:00"}',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own medications" ON public.medications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medications" ON public.medications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own medications" ON public.medications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own medications" ON public.medications FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Medication dose logs
CREATE TABLE public.medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  taken_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own medication_logs" ON public.medication_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medication_logs" ON public.medication_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own medication_logs" ON public.medication_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own medication_logs" ON public.medication_logs FOR DELETE USING (auth.uid() = user_id);