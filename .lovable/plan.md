# Switch OTP back to MSG91 WhatsApp only (no SMS)

## What changes

Login and registration OTPs go back to being sent by MSG91 on the WhatsApp template `verification_otp`. Firebase phone auth (reCAPTCHA + SMS) is removed from the OTP screen, and the MSG91 SMS (Flow) channel stays switched off — WhatsApp is the only delivery channel for now.

## Behaviour after the change

- User enters phone -> receives the 6-digit code on WhatsApp.
- Entering the code verifies it server-side and signs the user in (existing magic-link token exchange, already handled on the login page).
- If WhatsApp delivery fails, the screen shows the real error instead of silently falling back to SMS.
- App Store reviewer bypass numbers and the fixed review code keep working unchanged.
- Rate limit stays at 3 requests / 10 minutes; code validity 5 minutes (the on-screen text saying "from your SMS ... valid for 10 minutes" will be corrected to WhatsApp / 5 minutes).

## Technical detail

`src/components/OtpVerification.tsx`
- Remove Firebase imports (`RecaptchaVerifier`, `signInWithPhoneNumber`, `ConfirmationResult`), the `window.recaptchaVerifier` global and the recaptcha container usage.
- `sendOtp()` calls `supabase.functions.invoke("send-otp", { body: { phone, action: "send" | "resend", purpose } })`; handle `rate_limited` (429) into the existing `rate_limited` send state.
- `verifyOtp()` calls `send-otp` with `{ action: "verify", phone, otp, purpose }` and passes `{ token_hash, email, no_account }` straight to `onVerified` — the same shape `Login.tsx` already consumes and `Register.tsx` expects.
- Update the helper copy to reference WhatsApp and 5 minutes.

`supabase/functions/send-otp/index.ts`
- Drop the MSG91 Flow (SMS) dispatch from the send path; send only the WhatsApp template. Report `channels: { sms: "disabled", whatsapp: ... }`, persist the OTP hash when WhatsApp succeeds, and return an error when WhatsApp fails.
- Stop requiring `MSG91_OTP_TEMPLATE_ID` for startup config validation (only `MSG91_AUTH_KEY` is needed); the SMS template id stays in place unused so SMS can be re-enabled later.
- Verify path, hashing, rate limiting, review bypass and magic-link session creation are untouched.
- Redeploy `send-otp` after the edit.

The `firebase-auth` edge function and `src/integrations/firebase/client.ts` are left in place (unused by login) so SMS fallback can be re-enabled without redoing the work.
