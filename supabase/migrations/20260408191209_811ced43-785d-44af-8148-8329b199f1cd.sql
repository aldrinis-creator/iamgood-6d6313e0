
CREATE OR REPLACE FUNCTION public.insert_notifications_deduped(
  p_notifications jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif jsonb;
BEGIN
  FOR notif IN SELECT * FROM jsonb_array_elements(p_notifications)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = (notif->>'user_id')::uuid
        AND type = COALESCE(notif->>'type', 'general')
        AND title = notif->>'title'
        AND created_at > now() - interval '1 hour'
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, type, guardian_id)
      VALUES (
        (notif->>'user_id')::uuid,
        notif->>'title',
        notif->>'message',
        COALESCE(notif->>'type', 'general'),
        (notif->>'guardian_id')::uuid
      );
    END IF;
  END LOOP;
END;
$$;
