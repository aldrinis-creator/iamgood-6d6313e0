
## Plan — Fix MSG91 template name validation error

### What the error means

MSG91 is rejecting the template name with: *"The message template name can only have lower-case letters and underscores."*

This is a **MSG91 dashboard validation rule** when you create/register a new WhatsApp or SMS template. The template **name field** (not the body content) must match: `^[a-z_]+$` — only lowercase letters and underscores. No digits, no hyphens, no spaces, no uppercase.

This is not a code issue in your project — it's about what you type into the "Template Name" field in the MSG91 dashboard when registering the Guardian Invite template from the previous step.

### Recommended template names

For the Guardian Invite templates you're creating, use these MSG91-valid names:

- **WhatsApp template name:** `guardian_nomination_invite`
- **SMS template name:** `guardian_nomination_invite_sms`

Both are all lowercase, underscores only — they will pass MSG91 validation.

### After approval — what to do with the Template ID

1. MSG91 will issue a Template ID once the template is approved (different from the name).
2. Copy that Template ID.
3. Update the `MSG91_INVITE_TEMPLATE_ID` secret in Lovable Cloud → Backend → Secrets with the new ID (the secret already exists; just paste the new value).
4. No code redeploy is needed — `send-guardian-invite` reads the secret at request time.

### Verification

1. MSG91 accepts the template name without the lowercase/underscore error.
2. Once approved, sending an invite from My Profile triggers `send-guardian-invite`, and the function logs (already added in the previous step) show MSG91 returning `type: "success"` with a `request_id`.
3. The new guardian receives the WhatsApp invite on their handset.

### What I will NOT change

- No code edits — this is purely a MSG91 dashboard naming issue.
- No secret rotation unless MSG91 issues a new Template ID after approval.
