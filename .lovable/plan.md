# Which MSG91 template should carry the Guardian app invite

## What is confirmed in the code

- The invite currently sends the WhatsApp template `guardian_invite_app_downlaod` on namespace `e67e5302_b6d0_403e_b3cc_8fa6e8accb01`, language `en`, with four body params (guardian name, ward name, relation, install link) — `supabase/functions/send-guardian-invite/index.ts`.
- MSG91 **accepted** the last send (`status: success`, request_id `ed52c4ef…`), so the name/namespace pair is valid; the message failed later, at delivery.
- The legacy MSG91 **Flow SMS** invite template is disabled in code because its approved copy carries an outdated hardcoded link.

## The honest answer

Which template is "correct" cannot be settled from the code alone — the deciding facts live in the MSG91 account: the exact approved template name (note the misspelling `downlaod`), its approved language code (`en` vs `en_US`), and whether its 4th value is a **body variable** or a **URL button** variable. A body param sent against a button-variable template is accepted at submit time and then fails at delivery, which matches exactly what we are seeing.

So the plan is: read the approved template definition first, then lock the payload to it.

## Plan

1. **Read the approved template from MSG91**
   - Extend the existing diagnostic function `msg91-template-info` to list WhatsApp templates for the integrated number (`917045868482`) instead of only fetching by id, and run it.
   - Output we need: the template's exact `name`, `language`, `namespace`, `status` (APPROVED / REJECTED / PAUSED / DISABLED), body variable count, and button type.

2. **Pull the delivery report for the failed send**
   - Add `msg91-wa-report` (service-role / cron-secret guarded) that queries MSG91's WhatsApp report endpoint for `ed52c4ef46a14a8f8a4c7d8f4db14873` and returns the literal per-recipient failure code.
   - This tells us whether the rejection was template-level (language/params) or recipient-level (not on WhatsApp / opted out).

3. **Align `send-guardian-invite` to whatever step 1 and 2 report**
   - Language mismatch: change `languageCode` to the approved code.
   - Link is a URL button: move `installLink` from `body_4` to `button_1_url` (the shared helper already supports it).
   - Template not approved/usable: fall back to the plain approved `welcome`-style invite template, or re-enable the Flow SMS after its link variable is fixed.

4. **Make delivery visible**
   - Persist the delivery-report status into `notification_logs.metadata` after each invite, and show a "WhatsApp not delivered" state on the ward's guardian card, with a one-tap "share invite link" fallback so the ward can send `https://iamgood.lovable.app/install?g=<token>` themselves.

## Technical notes

- Edited: `supabase/functions/msg91-template-info/index.ts` (add template-list endpoints), `supabase/functions/send-guardian-invite/index.ts` (payload alignment + store delivery status).
- New: `supabase/functions/msg91-wa-report/index.ts`.
- `supabase/functions/_shared/msg91Whatsapp.ts` changes only if the button-variable path is needed.
- No schema change, no new secrets.
