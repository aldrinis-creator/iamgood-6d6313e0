# DLT + MSG91 SMS template for the Guardian app invite

Goal: an approved, DLT-compliant SMS template so the invite has a reliable text fallback that WhatsApp alone can't guarantee. Keep the link personal via a MSG91 Flow variable, never a hardcoded URL.

## DLT (operator) side — register the template

| Field | Value |
|---|---|
| Sender ID | `CHKIIN` (same registered sender as your OTP SMS) |
| Category | Transactional |
| DLT Template ID | (issued by your DLT portal after approval — keep handy) |
| Template Type | Service Implicit (no explicit opt-in required) |

**Template text (submit verbatim — DLT is character-exact)**

```text
Dear {#var#},

{#var#} has nominated you as their Guardian on Check-iN. As Guardian, you will receive their daily check-in status, missed medication alerts and SOS emergencies.

Install the Guardian app and accept the nomination:
{#var#}

This link expires in 4 days. Check-iN - Personal Emergency Response System.
```

That is exactly three `{#var#}` placeholders: guardian_name, user_name, install_link.

## MSG91 side — create the Flow template

| Field | Value |
|---|---|
| Flow Name | `Guardian Invite App Download` |
| Flow ID / Template ID | (MSG91 assigns it — set it as `MSG91_INVITE_TEMPLATE_ID`) |
| Sender ID | `CHKIIN` |
| Channel | SMS |
| DLT Template ID | the ID issued above |

**Flow body (mirrors the DLT text)**

```text
Dear ##guardian_name##,

##user_name## has nominated you as their Guardian on Check-iN. As Guardian, you will receive their daily check-in status, missed medication alerts and SOS emergencies.

Install the Guardian app and accept the nomination:
##install_link##

This link expires in 4 days. Check-iN - Personal Emergency Response System.
```

## How the code calls it

`send-guardian-invite` already sends this Flow with the right variables; the only change is re-enabling the SMS path once the template is approved.

- `supabase/functions/send-guardian-invite/index.ts`: keep the existing SMS block; set `GUARDIAN_INVITE_SMS_ENABLED=true` once the DLT + Flow templates are both approved.
- Variables passed today: `guardian_name`, `user_name`, `relation`, `accept_link`, `install_link`, `reject_link`. After approval, `install_link` should equal `https://iamgood.lovable.app/install?g=<nomination_token>`.
- Once live, the function logs the MSG91 Flow response and records it as `result.sms`.

## Why these choices

- Single short URL (`install_link`) keeps the SMS under the 160→306 char split.
- The `/install?g=<token>` URL carries the nomination token, so the guardian installs → accepts in one flow tied to the right ward.
- No hardcoded URL — the link is always the current `installLink`, so future domain changes need no template re-approval.
- 4-day expiry note matches the nomination expiry in the database (4 days), so the message can't mislead.

## Pre-flight checks before going live

- DLT approval status: APPROVED (send a test to a non-DND number).
- MSG91 Flow status: APPROVED.
- Sender ID `CHKIIN` active on the route.
- Test send to +91 99671 34652 and confirm the link is clickable and lands on `/install?g=<token>`.
