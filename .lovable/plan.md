# Restore WhatsApp OTP on login

## Why it stopped

Login was switched to Firebase phone auth. The sign-in screen now calls Firebase directly (`signInWithPhoneNumber` + reCAPTCHA) and then exchanges the Firebase ID token via the `firebase-auth` function. The MSG91 `send-otp` function — the only thing that sends the WhatsApp `verification_otp` template — is no longer called at all. The OTP event log confirms this: the last entries are from 12 Aug, before the switch, and nothing since.

Firebase sends SMS only and never exposes its code, so it can't be mirrored to WhatsApp.

## What changes

Make MSG91 the primary OTP channel again (SMS + WhatsApp), with Firebase SMS kept as an automatic fallback.

Flow on the login screen:

```text
Enter phone
  -> call send-otp (MSG91: SMS + WhatsApp verification_otp)
       success -> user types 6-digit code -> send-otp verify -> session
       failure -> fall back to Firebase phone auth (reCAPTCHA + SMS)
                  -> user types code -> firebase-auth -> session
```

- No reCAPTCHA on the normal path (faster, fewer failures on mobile).
- Reviewer bypass numbers keep working exactly as today (fixed code, no dispatch).
- Resend uses the same channel that was used to send.

## Technical detail

- `src/components/OtpVerification.tsx`: restore the `send-otp` invoke path for send/resend/verify (verify returns `token_hash` + `email`, consumed with `verifyOtp({ type: 'magiclink' })` as before). Keep the existing Firebase code path intact and enter it only when `send-otp` returns a non-success (or throws). Track which channel is active so verify routes to the right backend.
- No changes to `supabase/functions/send-otp` logic; it already sends both SMS (Flow) and WhatsApp (`verification_otp`, language `en`).
- No changes to `firebase-auth`.

## Verification

After the change, request an OTP for a real number and confirm: a `send`/`send_wa` pair appears in the OTP event log with status `sent`, and the WhatsApp message arrives. If `send_wa` logs `failed`, the cause is on the MSG91 template/number side and I'll report the exact error returned.
