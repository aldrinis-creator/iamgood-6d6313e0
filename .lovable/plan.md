# Fix OTP delivery for Aldrin, and check email sign-in

## What's wrong with the OTP (confirmed)

Aldrin's number (+91 98195 76467) is one of the two App Store reviewer numbers. The OTP function treats reviewer numbers as "skip dispatch" accounts, so it deliberately sends nothing over SMS or WhatsApp and only accepts the fixed review code. The backend logs for tonight confirm this: every send/resend for 919819576467 logged `review bypass: skipping dispatch`.

So the OTP is not failing — it is being suppressed on purpose for that number. Right now the only way in with that number is the fixed reviewer code.

## The fix

Change the reviewer bypass from "instead of" to "in addition to":

- For reviewer numbers, send the real OTP over SMS and WhatsApp exactly like any other number, and keep the normal rate limit generous but present.
- On verify, accept either the real generated OTP or the fixed reviewer code. Apple's reviewer still gets in with the fixed code without needing an Indian SMS; Aldrin gets a real OTP on his phone again.
- Keep the reviewer premium-access grant and the audit logging as they are.

If instead you'd rather keep dispatch fully suppressed for the reviewer's number only, the alternative is to drop +91 98195 76467 from the reviewer list and leave only the guardian demo number — say the word and I'll do that instead.

## Email sign-in

The auth logs show two successful password logins for aldrin@futurewave.in tonight (both HTTP 200), so the credentials and the auth service are working. That means the failure is after sign-in, on the client. I'll reproduce a real email login against the app in a browser, capture the console and network output, and fix whatever blocks the dashboard from rendering — the most likely candidate is the recent switch of avatars to a private bucket with signed URLs. I'm not asserting that as the cause until the reproduction shows it.

## Technical details

- `supabase/functions/send-otp/index.ts`: remove the early-return in the review branch for `send`/`resend` so those actions fall through to the normal Flow API + WhatsApp dispatch path; in the `verify` branch, compare against `REVIEW_OTP_CODE` first and fall through to the normal hashed-OTP comparison on mismatch.
- No schema changes, no secret changes.
- `docs/appstore-submission.md` gets a one-line note that reviewer numbers now also receive a real SMS.
