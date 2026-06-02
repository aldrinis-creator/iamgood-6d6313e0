ALTER TABLE public.medication_logs
  ADD COLUMN IF NOT EXISTS whatsapp_alerted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_medication_logs_missed_wa
  ON public.medication_logs (scheduled_at)
  WHERE status = 'missed' AND whatsapp_alerted_at IS NULL;