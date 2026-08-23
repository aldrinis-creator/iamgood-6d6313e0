# OTP delivery visibility

You asked whether the two proposed items are needed. My recommendation: build one, skip one, and add a small fix that helps real users.

## Skip: channel + request id on the OTP screen

OTPs go out on a single MSG91 `otp-fallback` Flow. The Flow itself decides WhatsApp first, SMS fallback, and its response returns only a `request_id` — it never tells us which channel actually delivered. So a "sent via WhatsApp" line would be a guess, and a request id means nothing to an elderly user. Not worth the clutter.

## Build: admin OTP log page

The data is already captured on every send and verify (`otp_events`: phone, action, request_id, status, delivery status, verified flag, timestamps). Today only I can read it. A page gives you self-service debugging the next time someone says "no code arrived".

`/admin/otp-log`, styled like the existing admin email page:

- Filter by time range (24h / 7d / 30d) and by phone (partial match).
- Table columns: time (IST), phone (masked to last 4 by default, with a reveal toggle), purpose/action (send / resend / verify), status, delivery status from the MSG91 webhook, verified, request id (copyable), failure reason.
- Summary strip at the top: sends, verified, failed, and verification rate for the selected range.
- Refresh button; no editing or deleting from the page.

## Build: plain-language failure on the OTP screen

When a send is rejected, the screen currently shows a generic error. Replace it with the actual reason in plain words (rate limited, number not reachable, invite-number mismatch) plus a "Didn't get the code? Try again in Xs or contact support" line. This is the part users actually feel.

## Technical notes

- `otp_events` has a single service-role policy, so the page reads through a new `admin-otp-log` edge function that validates the caller's JWT, requires the `admin` role via `has_role`, requires the existing admin step-up token, and returns masked phones by default. No new table, no RLS change, no client-side access to raw OTP rows.
- New files: `src/pages/AdminOtpLog.tsx`, `supabase/functions/admin-otp-log/index.ts`. Route added in `src/App.tsx` behind `AdminRoute`, link added in `src/components/AdminSidebar.tsx`.
- OTP screen copy changes are confined to `src/components/OtpVerification.tsx`; `send-otp` already returns specific error strings.
- `otp_hash` is never selected or returned.
