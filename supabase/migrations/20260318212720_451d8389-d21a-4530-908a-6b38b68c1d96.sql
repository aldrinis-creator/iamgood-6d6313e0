
CREATE TABLE public.nutrition_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diet_type text NOT NULL DEFAULT 'vegetarian',
  allergies text[] DEFAULT '{}',
  health_goals text[] DEFAULT '{}',
  weight_kg numeric,
  age integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.nutrition_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own persona" ON public.nutrition_personas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own persona" ON public.nutrition_personas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own persona" ON public.nutrition_personas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own persona" ON public.nutrition_personas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_nutrition_personas_updated_at BEFORE UPDATE ON public.nutrition_personas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
