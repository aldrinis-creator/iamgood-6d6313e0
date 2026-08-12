
-- 1. Avatars: replace public-read policy with scoped access
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Avatars readable by owner, guardians and wards"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.status = 'accepted'
        AND (
          (g.user_id::text = (storage.foldername(name))[1] AND g.guardian_user_id = auth.uid())
          OR (g.guardian_user_id::text = (storage.foldername(name))[1] AND g.user_id = auth.uid())
        )
    )
  )
);

-- 2. contact_submissions: remove unrestricted public insert, force attribution for signed-in users
DROP POLICY IF EXISTS "Allow public insert to contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Users can submit contact form" ON public.contact_submissions;

CREATE POLICY "Users can submit contact form"
ON public.contact_submissions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. vault_nominee_claims: admin update needs WITH CHECK + immutable ownership
DROP POLICY IF EXISTS "Admins update claims" ON public.vault_nominee_claims;

CREATE POLICY "Admins update claims"
ON public.vault_nominee_claims FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.prevent_vault_claim_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'user_id on a vault claim cannot be changed';
    END IF;
    IF NEW.guardian_id IS DISTINCT FROM OLD.guardian_id THEN
      RAISE EXCEPTION 'guardian_id on a vault claim cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vault_claim_no_reassign ON public.vault_nominee_claims;
CREATE TRIGGER trg_vault_claim_no_reassign
BEFORE UPDATE ON public.vault_nominee_claims
FOR EACH ROW EXECUTE FUNCTION public.prevent_vault_claim_reassignment();
