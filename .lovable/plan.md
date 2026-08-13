# Fix: Aldrin never receives the WhatsApp OTP

## What the logs show

Every OTP request for Aldrin's number is logged as:

```text
[send-otp] action=send phone=919819576467 purpose=login
[send-otp] review bypass: skipping dispatch for 919819576467
```

The number is still on the App Store reviewer list (`REVIEW_PHONES`). For any number on that list, `send-otp` deliberately skips MSG91 dispatch and only accepts the fixed code `420666`. So no WhatsApp message is ever generated — the delivery path is fine, it is simply never entered.

The same happens for `917045868482` (the guardian reviewer account), which is intended.

## Fix

1. Remove `+91 98195 76467` (Aldrin) from the `REVIEW_PHONES` secret, leaving only the guardian reviewer number `+91 70458 68482` with code `420666`.
2. Re-test: request an OTP for Aldrin's number and confirm the log shows a WhatsApp dispatch (`Dispatching WhatsApp OTP ... template=verification_otp`) and a `sent` row in the OTP log instead of a bypass.
3. If MSG91 returns an error at that point, report the exact MSG91 response (template/namespace/language mismatch is the usual cause) and fix that as a follow-up.

## Note on App Store review

The submission doc lists Aldrin's number as the senior demo account with a fixed OTP. After this change that account needs a real WhatsApp OTP to sign in. Options:

- Keep the reviewer bypass only on the guardian number and point the reviewer at a different senior demo account, or
- Also send a real OTP for reviewer numbers while still accepting `420666` (a small change in `send-otp`, best of both).

Tell me which you prefer; the default in this plan is option 1 (Aldrin becomes a normal account).

## Technical detail

Only the `REVIEW_PHONES` secret changes. No code change to `supabase/functions/send-otp/index.ts` is required for the fix itself; the WhatsApp-only path (`verification_otp`, language `en`) already runs for every non-reviewer number.
