REVOKE EXECUTE ON FUNCTION public.read_dlq_messages(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.requeue_dlq_message(text, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purge_dlq(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_dlq_messages(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.requeue_dlq_message(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_dlq(text) TO authenticated, service_role;