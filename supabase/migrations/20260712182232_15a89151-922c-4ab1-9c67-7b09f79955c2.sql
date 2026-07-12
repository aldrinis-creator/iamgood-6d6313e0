
REVOKE EXECUTE ON FUNCTION public.dispatch_sos_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sos_events_after_insert_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sos_dispatch_safety_net() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_sos_alert(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sos_dispatch_safety_net() TO service_role;
