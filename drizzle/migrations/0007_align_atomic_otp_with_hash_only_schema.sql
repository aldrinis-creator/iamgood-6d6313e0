CREATE OR REPLACE FUNCTION public.consume_login_otp(_phone text, _hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ids uuid[]; _match boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_phone, 0));
  SELECT array_agg(id), bool_or(otp_hash = _hash AND COALESCE(attempts,0) < 5) INTO _ids, _match
  FROM public.otp_events WHERE phone = _phone AND action IN ('send','resend') AND status = 'sent' AND otp_hash IS NOT NULL AND expires_at >= now();
  IF _ids IS NULL THEN RETURN 'expired'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.otp_events WHERE id = ANY(_ids) AND COALESCE(attempts,0) < 5) THEN RETURN 'too_many_attempts'; END IF;
  IF NOT COALESCE(_match,false) THEN
    UPDATE public.otp_events SET attempts = COALESCE(attempts,0) + 1 WHERE id = ANY(_ids);
    RETURN 'wrong_code';
  END IF;
  UPDATE public.otp_events SET verified = true, status = 'verified', otp_hash = NULL WHERE id = ANY(_ids);
  RETURN 'verified';
END;
$$;
REVOKE ALL ON FUNCTION public.consume_login_otp(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_login_otp(text,text) TO service_role;