ALTER TABLE public.otp_events RENAME COLUMN otp_code TO otp_hash;
COMMENT ON COLUMN public.otp_events.otp_hash IS 'SHA-256 hash of the OTP. Never stores plaintext; nulled on successful verification.';