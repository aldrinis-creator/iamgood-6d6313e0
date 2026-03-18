
CREATE TABLE public.care_journal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood TEXT NOT NULL,
  symptoms TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.care_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own journal entries"
  ON public.care_journal FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON public.care_journal FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON public.care_journal FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON public.care_journal FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_care_journal_updated_at
  BEFORE UPDATE ON public.care_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
