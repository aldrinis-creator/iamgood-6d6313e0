DROP POLICY IF EXISTS "Anyone can read blood banks" ON public.blood_banks;
REVOKE SELECT ON public.blood_banks FROM anon;
CREATE POLICY "Authenticated can read blood banks" ON public.blood_banks FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.blood_banks TO authenticated;