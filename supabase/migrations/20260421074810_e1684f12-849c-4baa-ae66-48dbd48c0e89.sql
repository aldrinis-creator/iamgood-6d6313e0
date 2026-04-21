-- Contact submissions table
CREATE TABLE public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text NOT NULL,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'app-profile',
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions(created_at DESC);
CREATE INDEX idx_contact_submissions_user_id ON public.contact_submissions(user_id);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert (own or anonymous)
CREATE POLICY "Users can submit contact form"
ON public.contact_submissions
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Anonymous (anon) can also submit (for website form, with user_id null)
CREATE POLICY "Anon can submit contact form"
ON public.contact_submissions
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Users can view their own submissions
CREATE POLICY "Users can view own contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all
CREATE POLICY "Admins can update contact submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role full access
CREATE POLICY "Service role manages contact submissions"
ON public.contact_submissions
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');