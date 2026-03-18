
ALTER TABLE public.guardians ADD COLUMN guardian_email text;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  guardian_id uuid REFERENCES public.guardians(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'missed_checkin',
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Guardians can view notifications addressed to them
CREATE POLICY "Guardians can view their notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (guardian_id IN (
  SELECT g.id FROM public.guardians g
  WHERE g.guardian_phone IN (
    SELECT p.phone FROM public.profiles p WHERE p.id = auth.uid()
  )
));

-- Guardians can mark their notifications as read
CREATE POLICY "Guardians can update their notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (guardian_id IN (
  SELECT g.id FROM public.guardians g
  WHERE g.guardian_phone IN (
    SELECT p.phone FROM public.profiles p WHERE p.id = auth.uid()
  )
));

-- Users can view notifications about them
CREATE POLICY "Users can view notifications about them"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
