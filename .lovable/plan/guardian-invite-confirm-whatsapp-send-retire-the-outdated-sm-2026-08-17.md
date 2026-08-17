# Guardian invite: confirm WhatsApp send, retire the outdated SMS

## What the data shows

- Lira Alphonso's nomination is still `pending` (token `46ec…fa3c`, nominated 16 Aug), with `reminder_count = 0` and no install confirmation.
- Three invite dispatches were logged for her address (16 Aug 06:35, 16 Aug 17:33, 17 Aug 15:12 UTC). The most recent one ran after the personalised-template change was deployed.
- The dispatch log only records `email/sms` status — the WhatsApp result is not stored, and edge function logs for `send-guardian-invite` are no longer retained. So there is currently **no evidence either way** on whether the WhatsApp template was accepted by MSG91 for her number. That has to be verified with a fresh send, not assumed.
- The SMS she received comes from a separate MSG91 Flow template (`MSG91_INVITE_TEMPLATE_ID`). Its wording and any hardcoded link live in the MSG91 dashboard, not in our code — our code only passes `accept_link`/`install_link` variables. If that template hardcodes an old URL, the app cannot fix it.

## Plan

1. **Make WhatsApp results observable**
   - Log the full MSG91 WhatsApp response body (status, request id, error code) in `send-guardian-invite`.
   - Record the WhatsApp outcome in `notification_logs.status` (`email/sms/whatsapp`) and store the MSG91 response id in `metadata`, so every future invite is auditable without live logs.

2. **Bypass the rate limiter for an explicit re-send**
   - Add an optional `force: true` flag (server-side only, used by the re-send action) so a diagnostic re-send within the hour is not silently swallowed by the 1-hour rate limit.

3. **Re-send Lira's invite and read the MSG91 response**
   - Fire one invite to +91 99671 34652 with the existing token and report exactly what MSG91 returned for `guardian_invite_app_downlaod`: accepted, or the specific rejection (template/namespace/param mismatch, opt-in, throttling).
   - If MSG91 rejects on parameter count, switch `body_4` to the URL-button variable (`button_1_url`) with the same install link and re-test.

4. **Stop the outdated SMS**
   - Since email + WhatsApp both carry the correct `/install?g=<token>` link, disable the legacy Flow SMS in `send-guardian-invite` (keep it behind a flag) so guardians stop receiving the stale message. If you would rather keep SMS, the MSG91 Flow template itself needs to be re-approved with the `##install_link##` variable instead of a fixed URL — that is a dashboard change on your side.

## Technical notes

- Files touched: `supabase/functions/send-guardian-invite/index.ts` (logging, whatsapp status in log row, `force` flag, SMS toggle); possibly `supabase/functions/_shared/msg91Whatsapp.ts` if the button-variable fallback is needed.
- No schema change, no new secrets.
- Step 3 sends a real WhatsApp message to the guardian's number.
