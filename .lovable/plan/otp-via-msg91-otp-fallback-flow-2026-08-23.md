# OTP via MSG91 `otp-fallback` Flow

## Current state (verified)

`supabase/functions/send-otp/index.ts` already dispatches OTPs through exactly the endpoint you pasted:

- POST `https://control.msg91.com/api/v5/oneapi/api/flow/otp-fallback/run`
- Header `authkey: MSG91_AUTH_KEY`
- Body: `data.sendTo[0]` with both the per-recipient `to[].variables` and the group-level `variables`, each carrying `body_1` (text), `button_1` (url subtype) and `var1` — all set to the generated 6-digit code.

The OTP itself is generated in-app, stored as a SHA-256 hash in `otp_events` with a 5-minute expiry, rate-limited to 3 sends per 10 minutes, and nullified on successful verification. WhatsApp-with-SMS-fallback is handled by the Flow itself, so no separate SMS call is made.

So no code change is required to adopt this Flow — it is the live path.

## Proposed work

1. Fire one live test send through `send-otp` to a number you nominate and read the MSG91 response plus the edge-function log, to confirm the Flow returns a non-error type and the message is actually delivered (WhatsApp first, SMS fallback).
2. If the response shows a variable-mapping or template error, adjust the variable block in the payload to match what the Flow expects (e.g. drop `button_1` if the registered template has no URL button) and re-test.
3. No change to verification, rate limiting, or the reviewer-bypass path.

## Technical notes

- Only file that would change: `supabase/functions/send-otp/index.ts` (payload variables only).
- Client (`src/components/OtpVerification.tsx`) is unaffected: Indian numbers go through `send-otp`, international numbers stay on Firebase phone auth.
