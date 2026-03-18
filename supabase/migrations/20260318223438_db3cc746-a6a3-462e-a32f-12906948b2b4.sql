
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  start_time time NOT NULL,
  end_date date,
  end_time time,
  appointment_type text NOT NULL DEFAULT 'in-person',
  recurrence text NOT NULL DEFAULT 'none',
  location text,
  doctor_name text,
  alarm_enabled boolean NOT NULL DEFAULT true,
  alarm_sound text NOT NULL DEFAULT 'default',
  first_alert text NOT NULL DEFAULT '15min',
  second_alert text,
  shared_with_doctor boolean NOT NULL DEFAULT false,
  share_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
