# Remove Aldrin's number from the reviewer list

Aldrin's number (+91 98195 76467) is currently in the App Store reviewer bypass list, so the OTP function deliberately skips SMS and WhatsApp dispatch for it and only accepts the fixed reviewer code. Removing it restores normal OTP delivery for that number.

## What changes

- The reviewer phone list keeps only the guardian demo number (+91 70458 68482). Aldrin's number is dropped.
- Aldrin's number then goes through the standard path: real 6-digit OTP generated, sent over SMS and WhatsApp, normal 5-minute expiry and rate limit, hashed storage.
- The fixed code `420666` no longer works for Aldrin's number; it still works for the guardian demo number.
- The reviewer premium grant and audit logging stay as they are.

## App Store impact

Apple's reviewer would then have only the guardian demo account for sign-in. If they also need a senior-role account without receiving an Indian SMS, a separate senior demo number should be added to the reviewer list — otherwise the senior view is not reachable by the reviewer.

## Technical details

- Update the `REVIEW_PHONES` backend secret to contain only `+917045868482`. No code change is required in `supabase/functions/send-otp/index.ts` — the bypass is keyed entirely off that secret.
- Update `docs/appstore-submission.md` review notes so the senior demo credentials no longer point at Aldrin's number.
