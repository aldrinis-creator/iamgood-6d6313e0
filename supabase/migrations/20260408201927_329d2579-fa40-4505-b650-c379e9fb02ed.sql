
-- Fix the security definer view by making it security invoker
DROP VIEW IF EXISTS public.guardians_emergency_safe;

CREATE VIEW public.guardians_emergency_safe
WITH (security_invoker = true)
AS
SELECT
  g.user_id,
  g.guardian_name,
  g.relation,
  g.is_primary
FROM public.guardians g;

GRANT SELECT ON public.guardians_emergency_safe TO anon;
GRANT SELECT ON public.guardians_emergency_safe TO authenticated;
