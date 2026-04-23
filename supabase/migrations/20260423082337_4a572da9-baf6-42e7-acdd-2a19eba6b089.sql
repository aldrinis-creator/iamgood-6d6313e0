CREATE TABLE public.sos_message_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sos_event_id uuid NOT NULL REFERENCES public.sos_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
  recipient_phone text NOT NULL,
  provider text NOT NULL DEFAULT 'msg91',
  request_id text,
  provider_status text,
  delivery_status text,
  failure_reason text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  failed_at timestamptz,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sos_msg_attempts_sos_event ON public.sos_message_attempts(sos_event_id);
CREATE INDEX idx_sos_msg_attempts_user ON public.sos_message_attempts(user_id);
CREATE INDEX idx_sos_msg_attempts_request ON public.sos_message_attempts(request_id);

ALTER TABLE public.sos_message_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own SOS attempts"
ON public.sos_message_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Accepted guardians can view ward SOS attempts"
ON public.sos_message_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.user_id = sos_message_attempts.user_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'accepted'
  )
);

CREATE TRIGGER update_sos_message_attempts_updated_at
BEFORE UPDATE ON public.sos_message_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();