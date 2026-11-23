ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS refill_due_since date;

CREATE OR REPLACE FUNCTION public.track_refill_due_since()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.remaining_quantity IS NOT NULL AND NEW.low_stock_threshold IS NOT NULL
     AND NEW.remaining_quantity <= NEW.low_stock_threshold THEN
    IF NEW.refill_due_since IS NULL THEN
      NEW.refill_due_since := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    END IF;
  ELSE
    NEW.refill_due_since := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_track_refill_due_since
BEFORE INSERT OR UPDATE OF remaining_quantity, low_stock_threshold ON public.medications
FOR EACH ROW EXECUTE FUNCTION public.track_refill_due_since();

UPDATE public.medications SET refill_due_since = (now() AT TIME ZONE 'Asia/Kolkata')::date
WHERE remaining_quantity IS NOT NULL AND low_stock_threshold IS NOT NULL
  AND remaining_quantity <= low_stock_threshold AND refill_due_since IS NULL;

CREATE TABLE public.refill_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL,
  user_id uuid NOT NULL,
  alert_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, alert_date)
);
GRANT SELECT ON public.refill_alert_log TO authenticated;
GRANT ALL ON public.refill_alert_log TO service_role;
ALTER TABLE public.refill_alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own refill alert log" ON public.refill_alert_log
FOR SELECT TO authenticated USING (auth.uid() = user_id);