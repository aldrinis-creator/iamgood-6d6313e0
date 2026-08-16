# Guardian invite via the new WhatsApp template

## What the new template gives us

`guardian_invite_app_downlaod` (namespace `e67e5302_b6d0_403e_b3cc_8fa6e8accb01`, language `en`) is sent through the same bulk WhatsApp Outbound API the app already uses for `welcome_user`, `ward_missed_check_in` and the safe-zone alerts.

Important: the sample payload sends `"components": {}` — the template carries **no variables**. So the message text and the app-download button are fixed inside the approved template; we cannot inject the guardian's name, the ward's name, or a per-guardian nomination token into it.

## How the invite flow will work

When a ward nominates a guardian (and on each of the 3 daily reminders):

1. **WhatsApp — new template.** Send `guardian_invite_app_downlaod` to the guardian's number via the shared MSG91 WhatsApp helper using the V2 namespace. This is the "download the Guardian app" message.
2. **SMS/Flow — personalised link.** Keep the existing MSG91 Flow message, which carries the personalised install-and-accept link `/install?g=<nomination_token>`. This is what actually ties the guardian to the right ward.
3. **Email.** Unchanged — branded `guardian-invitation` template with install + accept/reject links.

The response returned to the app gains a `whatsapp` channel status alongside `email` and `sms`, and the toast wording ("Invite sent by email and WhatsApp") reflects what actually went out. The existing one-hour re-send rate limit, notification log entry, reminder counter and ward escalation all stay as they are.

## Technical notes

- `supabase/functions/send-guardian-invite/index.ts`: add a WhatsApp step using `sendWhatsAppTemplate` from `_shared/msg91Whatsapp.ts` with `templateName: "guardian_invite_app_downlaod"`, `languageCode: "en"`, `namespace: WA_NAMESPACE_V2`, empty `components`, recipient normalised with `normalizeIndianPhone` (falling back to the existing digits-only normalisation for non-Indian numbers so global guardians still get it).
- Failures are logged and returned as `whatsapp: "failed"`; they never block the email or Flow SMS path.
- `src/lib/guardianInvite.ts`: extend `InviteChannels` with `whatsapp` and include it in the success summary.
- `guardian-invite-reminders` needs no change — it calls `send-guardian-invite`, so reminders pick up the WhatsApp template automatically.
- No new secrets, no schema change.

## One thing to confirm

Because the template has no variables, every guardian receives the same generic text. If you would rather the WhatsApp message name the ward and carry the personal accept link, the template needs re-approval with body variables and a dynamic URL button — say the word and I will plan that instead. ok , go ahead

&nbsp;