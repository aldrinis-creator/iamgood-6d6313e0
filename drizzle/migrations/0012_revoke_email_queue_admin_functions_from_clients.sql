REVOKE EXECUTE ON FUNCTION public.email_queue_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_dlq_messages(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_dlq(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.requeue_dlq_message(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_queue_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.read_dlq_messages(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_dlq(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_dlq_message(text, bigint) TO service_role;