# Guardian OTP after install: not arriving

## What the data shows (verified)

- `send-otp` logs for today show three dispatches for phone **919967134562** (16:41 send, 16:43 resend, plus 10:01/10:02 earlier). Each was logged in `otp_events` as `status: sent` with no failure reason, and every verify attempt from that number failed with "Invalid or expired OTP".
- Lira Alphonso's actual account and her corrected guardian record both carry **+919967134652**. OTPs sent to that number today (09:47, 10:00) were entered and verified successfully.
- So the OTP requests that "never arrive" are being sent to **919967134562** — a number that differs from her registered one by two transposed digits. The code is delivering; the destination is wrong.
- Secondary gap: `send-otp` calls the MSG91 `otp-fallback` Flow and treats an HTTP 200 as success. It does not store the MSG91 `request_id` or the response body, so a message that MSG91 accepts but never delivers (no WhatsApp account, DND, template issue) is still recorded as `sent`. There is no way today to tell "accepted" from "delivered".

## Fix

**1. Stop the wrong-number path on invite registration**

- On an invite link (`/register?nomination=accept&token=...` or resumed from a stashed token), the phone field is prefilled from the `guardians` record but stays freely editable. Make it read-only on that path, with a small "Not your number? Ask <ward> to correct it" note, so the guardian cannot retype a different number and lock themselves out.
- If the token lookup returns no phone, leave the field editable as today.

**2. Make delivery observable**

- Capture the MSG91 Flow response in `send-otp`: store `request_id` (and, on failure, the trimmed error body) in `otp_events.request_id` / `failure_reason` instead of passing `undefined`.
- Treat a response with no `request_id` as a failure rather than a success, so the UI shows a real error instead of "OTP sent".

**3. Guard against a silently undeliverable number**

- Before dispatch, if the request is a guardian registration carrying a nomination token, compare the submitted phone with the phone on the nomination record; on mismatch return a clear error ("This invite was sent to +91 …652") rather than dispatching to the typed number.

**4. Unblock Lira now**

- Re-send the OTP to the correct **+919967134652** so she can complete guardian sign-up with her existing account, and confirm from `otp_events` that a `request_id` comes back.

## Technical notes

- Files touched: `supabase/functions/send-otp/index.ts` (request_id capture, success criteria, nomination-phone check), `src/pages/Register.tsx` (lock prefilled phone on invite path).
- No schema change: `otp_events.request_id` already exists and is simply never populated.
- Rate limiting, hashing, review-bypass and the verify/magic-link path stay unchanged.
