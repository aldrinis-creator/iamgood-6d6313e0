

## Plan — Convert MSG91 invite template to numbered variables

MSG91 only accepts numbered variable placeholders (`{{1}}`, `{{2}}`, …). The named keys (`guardian_name`, `user_name`, etc.) we send in the API request must be mapped to those numbered slots inside MSG91's template configuration — they are not used as inline placeholders in the message body.

### What to paste into the MSG91 template body

```
🛡 *Guardian Nomination — Check-iN*

Hi {{1}}, {{2}}{{3}} has nominated you as their Guardian on Check-iN. Accept: {{4}} Reject: {{5}} After accepting, install the app from {{4}} → Add to Home Screen for instant SOS alerts.
```

Note: `{{4}}` (the accept link) appears twice — that is allowed; MSG91 simply substitutes the same value in both spots.

### Variable mapping to set inside the MSG91 template config

When MSG91 asks you to define what each numbered variable represents, map them as:

| Slot | Variable name in MSG91 config | Value the API sends |
|---|---|---|
| `{{1}}` | `guardian_name` | Guardian's first name (e.g. `Jane`) |
| `{{2}}` | `user_name` | Nominating user's name (e.g. `John`) |
| `{{3}}` | `relation` | ` (Son)` / ` (Spouse)` / `""` |
| `{{4}}` | `accept_link` | `https://iamgood.lovable.app/register?nomination=accept&token=…` |
| `{{5}}` | `reject_link` | `https://iamgood.lovable.app/register?nomination=reject&token=…` |

The keys on the right are exactly what `send-guardian-invite/index.ts` already sends in the MSG91 Flow API payload, so **no code change is required** — only the MSG91 dashboard template body and variable mapping need updating, then re-submit for approval.

### Concrete preview after substitution

```
🛡 *Guardian Nomination — Check-iN*

Hi Jane, John (Son) has nominated you as their Guardian on Check-iN. Accept: https://iamgood.lovable.app/register?nomination=accept&token=abc123 Reject: https://iamgood.lovable.app/register?nomination=reject&token=abc123 After accepting, install the app from https://iamgood.lovable.app/register?nomination=accept&token=abc123 → Add to Home Screen for instant SOS alerts.
```

### Verification

1. Paste the numbered template body into MSG91 and configure the 5 variable mappings as in the table above.
2. Submit for approval.
3. Once approved, send a fresh test invite from the app — the WhatsApp/SMS should render with the guardian's name, your name, relation, accept and reject links, and the install hint.

### What I will NOT change

- No code change in this repo — `send-guardian-invite` already sends the correct field keys.
- No DB migration, no new edge function.
- No changes to the email template (already updated previously).

