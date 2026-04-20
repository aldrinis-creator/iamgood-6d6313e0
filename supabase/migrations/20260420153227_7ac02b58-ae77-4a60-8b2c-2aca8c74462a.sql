CREATE TABLE public.premium_plus_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID,
  phone TEXT,
  full_name TEXT,
  source TEXT NOT NULL DEFAULT 'subscription_page',
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX premium_plus_waitlist_email_lower_idx
  ON public.premium_plus_waitlist (lower(email));

ALTER TABLE public.premium_plus_waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone may add themselves to the waitlist
CREATE POLICY "Anyone can join the waitlist"
ON public.premium_plus_waitlist
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- No SELECT/UPDATE/DELETE policies → only service_role can read/modify