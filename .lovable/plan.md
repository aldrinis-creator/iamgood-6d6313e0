# Demo account for App Store review

Yes — this must be filled in before you submit. Apple rejects any app whose sign-in cannot be completed by the reviewer. Check-iN logs in with a phone number plus an SMS/WhatsApp OTP, and Apple's reviewers (in the US) cannot receive an Indian OTP, so a fixed review code is required.

## What gets built

1. **Reviewer bypass in the OTP flow**
   Two phone numbers are treated as review accounts. For those numbers only:
   - `send` / `resend` skips the SMS and WhatsApp dispatch entirely (nothing is billed, nothing is sent).
   - `verify` accepts one fixed 6-digit code stored as a backend secret.
   - Everything after verification (session creation, role routing) stays identical to a real login, so the reviewer sees the real app.
   The allowed numbers and the fixed code live in backend secrets, not in code, so they can be rotated or disabled after approval without a new build.

2. **Two seeded accounts**
   - A senior ("user") account with sample medications, an appointment, a safe zone and a filled Medical Vault entry, so the reviewer sees a populated app rather than empty screens.
   - A guardian account already linked to that senior, so guardian alerts, reports and the ward view are testable.

3. **Doc update**
   `docs/appstore-submission.md` review notes get the real phone numbers and code in place of the `<TO BE PROVIDED>` placeholders, plus a line telling the reviewer no real SMS arrives and no emergency service is contacted.

## Technical details

- `supabase/functions/send-otp/index.ts`: early branch keyed on a normalized phone match against `REVIEW_PHONES` (comma-separated secret). On `send`/`resend` it returns `{ success: true, channels: { sms: "skipped" } }` without calling the MSG91 Flow or WhatsApp APIs. On `verify` it compares against `REVIEW_OTP_CODE` and, on match, follows the existing magic-link path (`get_email_by_phone` -> `generateLink`) so the session is created normally. Rate limiting is bypassed for these numbers. No plaintext OTP is written to `otp_events`; the events are logged with a `review_bypass` action for auditability.
- Two new secrets: `REVIEW_PHONES`, `REVIEW_OTP_CODE`.
- Seed data is inserted through a migration scoped to the two review user ids, so it never touches real users.

## What I need from you

- The two phone numbers to use as review accounts (they can be numbers you own, or throwaway ones — no SMS will ever be sent to them).
- The 6-digit code you want the reviewer to type, or I can generate one.

## Still open from the earlier submission pack

iOS payments: the current Razorpay redirect will be rejected if any paid unlock is reachable inside the app. It needs StoreKit in-app purchase or the upgrade path hidden in the iOS build — separate decision, not part of this change.
