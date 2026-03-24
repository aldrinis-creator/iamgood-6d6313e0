
CREATE TABLE public.meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_type text NOT NULL DEFAULT 'other',
  meal_name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_calories integer NOT NULL DEFAULT 0,
  total_protein_g numeric NOT NULL DEFAULT 0,
  total_carbs_g numeric NOT NULL DEFAULT 0,
  total_fats_g numeric NOT NULL DEFAULT 0,
  total_fiber_g numeric NOT NULL DEFAULT 0,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own meal_logs" ON public.meal_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select own meal_logs" ON public.meal_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own meal_logs" ON public.meal_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal_logs" ON public.meal_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.nutrition_personas ADD COLUMN IF NOT EXISTS daily_calorie_goal integer DEFAULT 2000;
