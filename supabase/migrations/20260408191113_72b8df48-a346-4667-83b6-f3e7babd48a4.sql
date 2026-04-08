
CREATE OR REPLACE FUNCTION public.insert_notification_deduped(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'general',
  p_guardian_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for duplicate within last 60 minutes
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = p_user_id
      AND type = p_type
      AND title = p_title
      AND created_at > now() - interval '1 hour'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, guardian_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_guardian_id);
END;
$$;
