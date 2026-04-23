## Plan — Hardcode the MSG91 SOS WhatsApp payload to match the working curl exactly

### What's wrong now

The current `send-sos-alert` edge function reads the WhatsApp template name, namespace, language, and integrated number from environment variables (`MSG91_SOS_TEMPLATE_NAME`, `MSG91_SOS_TEMPLATE_ID`, `MSG91_SOS_LANG`, `MSG91_INTEGRATED_NUMBER`). If any of these are missing, blank, or set to `"null"`, the payload sent to MSG91 silently differs from the curl example you provided — which is why WhatsApp never fires.

### What to change

Update `supabase/functions/send-sos-alert/index.ts` so the WhatsApp request is built with the **exact** values from your working curl, with no env-driven overrides:

- `integrated_number`: `"917045868482"` (hardcoded)
- `content_type`: `"template"`
- `messaging_product`: `"whatsapp"`
- `type`: `"template"`
- `template.name`: `"sos_alert_notification"` (hardcoded)
- `template.language.code`: `"en_US"` (hardcoded)
- `template.language.policy`: `"deterministic"` (hardcoded)
- `template.namespace`: `"e1e205a8_3b76_4c20_bde4_9f124a35c8c4"` (hardcoded, not nulled)
- `template.to_and_components`: one entry per recipient with `body_1..body_4` = `userName`, `istTimestamp`, `locationStr`, `healthSummary`

Only `MSG91_AUTH_KEY` will continue to be read from secrets (it's a credential, not a template config).

### Logging

Log the final payload (template name, namespace, recipient count) and the full MSG91 response body so the next test makes the failure mode visible if MSG91 still rejects.

### SMS path

Leave the SMS path (`MSG91_SOS_SMS_TEMPLATE_ID` via Flow API) unchanged — your message is specifically about the WhatsApp trigger.

### Files to modify

- `supabase/functions/send-sos-alert/index.ts` — replace env-driven WhatsApp template config with hardcoded values from the curl example.

### Verification

1. Deploy `send-sos-alert`.
2. Trigger SOS in the app with at least one accepted guardian whose phone is valid.
3. Check `[send-sos-alert] WA request` and `[send-sos-alert] WA response` logs — payload should match the curl exactly, and MSG91 should return `type: "success"` with a `request_id`.
4. Confirm WhatsApp message arrives on the guardian's phone.
5. Check SMS as that too is not triggering  
