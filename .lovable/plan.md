# New MSG91 WhatsApp template for the Guardian app invite

Replace the current `guardian_invite_app_downlaod` template with a clean, correctly-spelled one built the way Meta expects: personalised body variables plus a **dynamic URL button** carrying the nomination token. The current template puts the link inside the body, which is the most likely reason MSG91 accepts the send but Meta rejects it at delivery.

## Template to submit in MSG91

| Field | Value |
|---|---|
| Name | `guardian_invite_download` |
| Category | UTILITY |
| Language | `en` (English) |
| Namespace | same WA business namespace (`e67e5302_b6d0_403e_b3cc_8fa6e8accb01`) |
| Header | Text: `Guardian invitation — Check-iN` |
| Buttons | 1 × Visit website (dynamic URL) |

**Body**

```text
Hi {{1}},

{{2}} has nominated you as their Guardian on Check-iN ({{3}}).

As their Guardian you will receive their daily check-in status, missed-medication alerts and SOS emergencies.

Tap below to install the Check-iN Guardian app and accept the nomination. The link expires in 4 days.
```

**Footer**

```text
Check-iN — Personal Emergency Response System
```

**Button**

- Type: Visit website → Dynamic
- Text: `Install & Accept`
- URL: `https://iamgood.lovable.app/install?g={{1}}`

**Sample values for approval**

- {{1}} body = `Lira Alphonso`, {{2}} = `Aldrin Alphonso`, {{3}} = `Daughter`
- {{1}} button = `46ec46f5c1d24f0aa4d1b2c3d4e5f6a7`

## Why this shape

- Meta rejects/blocks UTILITY templates that carry raw URLs as body text far more often than button URLs; moving the install link to a dynamic URL button removes that failure mode.
- The token is the only button variable, so the same approved template serves every guardian and every reminder.
- Relation is a plain body variable with a `Guardian` fallback, so a blank relation never breaks the send.

## Code changes once it is approved

- `supabase/functions/send-guardian-invite/index.ts`: switch `templateName` to `guardian_invite_download`, send `body_1/2/3` (guardian name, ward name, relation) and `button_1_url` set to the **token only** (not the full URL — MSG91 appends it to the approved prefix). Keep the existing full `installLink` for email.
- `supabase/functions/_shared/msg91Whatsapp.ts`: already supports `button_1_url`; no change needed.
- `guardian-invite-reminders` picks the new template up automatically.
- Keep the old template name as a fallback for one release, and log the MSG91 response as we do today.
- No schema change, no new secrets.

## One check after approval

Send one invite and read the function log: MSG91 must return `success`, and the recipient should see the button. If MSG91 errors on component count, the button URL prefix in the approved template does not match `…/install?g=` and needs correcting there.
