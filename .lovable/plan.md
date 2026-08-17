# Guardian WhatsApp invites to Lira: find why they fail on delivery

## What is confirmed so far

- The last invite (17 Aug 15:56 UTC) was **accepted** by MSG91: `status: success`, `request_id ed52c4ef46a14a8f8a4c7d8f4db14873`, body "Your request is in process, check delivery reports for status".
- So the failure is **not** at submission time. It happens later, in MSG91's delivery report (template/recipient level), which we currently never read back — our log row stops at "accepted".
- Earlier dispatches (16 Aug, 17 Aug 15:12) predate WhatsApp logging, so only email/SMS status was recorded.

The exact rejection reason therefore has to be read from MSG91's delivery report before changing the template payload. Everything below is diagnose-first.

## Plan

1. **Read the delivery report for the accepted request**
   - Add a small internal edge function `msg91-wa-report` that calls MSG91's WhatsApp report/analytics endpoint for a given `request_id` (and/or recipient number) using `MSG91_AUTH_KEY`, and returns the raw per-recipient status and error code.
   - Run it for `ed52c4ef46a14a8f8a4c7d8f4db14873` and report the literal failure reason.

2. **Fix according to what MSG91 says** (most likely causes, in order):
   - *Template/language mismatch* — we send `language: "en"` with namespace `e67e5302_…`; if the approved template is `en_US`, every send fails at delivery. Fix: correct the language code.
   - *Parameter shape* — `body_4` carries a URL. If the approved template's 4th value is a URL **button** variable, the body param is rejected. Fix: move the install link to `button_1_url` (helper already supports it).
   - *Recipient not reachable on WhatsApp* — number `+91 99671 34652` not registered / opted out. Fix: nothing in code; fall back to email + re-enabled SMS.

3. **Make failures visible from now on**
   - Persist the delivery-report status back into `notification_logs.metadata` (a short poll after send, or an on-demand "check delivery" action next to Re-send invite in the guardian list).
   - Surface a plain "WhatsApp not delivered" state in the ward's guardian card so this never again looks like a silent success.

4. **Guarantee Lira gets the link meanwhile**
   - Confirm the branded email with `/install?g=<token>` reached `lirachris100@yahoo.com` (queued 15:56; check the transactional-email log and suppression list).
   - If WhatsApp turns out to be blocked for her number, offer a one-tap "share invite link" action so you can send `https://iamgood.lovable.app/install?g=46ec46f5…` from your own WhatsApp directly.

## Technical notes

- New: `supabase/functions/msg91-wa-report/index.ts` (service-role/cron-secret guarded, no client exposure).
- Edited: `supabase/functions/send-guardian-invite/index.ts` (store delivery status), `supabase/functions/_shared/msg91Whatsapp.ts` only if the button-variable fallback is needed.
- No schema change, no new secrets.
