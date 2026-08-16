# Why the guardian invite messages show no real names — and how to fix it

## What the code actually sends today (verified)

**WhatsApp** (`send-guardian-invite/index.ts`, lines 84-105)
The call sends the approved template `guardian_invite_app_downlaod` with:

```text
components: {}
```

That is exactly the payload from the curl sample you supplied — it carries **no variables at all**. So WhatsApp renders whatever fixed text was approved for that template. If the approved body contains `{{1}}`, `{{2}}` placeholders, Meta receives nothing for them and they come through empty or the send is rejected. Nothing in the app can inject the ward name, guardian name, relation or the personal download link into this template as it stands.

**SMS / Flow** (same file, lines 151-199)
The Flow call posts these recipient keys:

```text
mobiles, guardian_name, user_name, relation, accept_link, install_link, reject_link
```

MSG91 Flow substitutes a variable **only when the key name matches the variable defined in the Flow template exactly** (case-sensitive). If the template was built with different variable names (`##VAR1##`, `##name##`, `##link##`, etc.), every one of ours is ignored and the message goes out with empty or literal placeholders. This is the most likely cause of the blank SMS fields, and it can only be confirmed against the variable list shown on the Flow template in MSG91.

## The fix

**1. WhatsApp — the template must be re-created with variables**
There is no code-only fix. A new template (e.g. `guardian_invite_app_download_v2`) needs approval with:

- Body variables: `{{1}}` guardian name, `{{2}}` ward name, `{{3}}` relation
- A dynamic URL button whose suffix variable carries the nomination token, so the button opens `https://iamgood.lovable.app/install?g={{1}}`

Once approved, the app sends `body_1`, `body_2`, `body_3` and `button_1_url` through the existing shared helper (`_shared/msg91Whatsapp.ts` already supports all four). Until then, the current template stays as a generic "download the app" nudge and the personal link keeps travelling by SMS and email.

**2. SMS / Flow — align variable names**
Confirm the exact variable names on the Flow template behind `MSG91_INVITE_TEMPLATE_ID` and rename the keys in the Flow payload to match them one-for-one. Also drop `short_url: "1"` if URL shortening is not enabled on the account, since that alone can blank out the link variable.

**3. Verification**
Re-send the invite to the test guardian and read the MSG91 response body plus the delivered message, confirming each field is filled.

## What I need from you

- A screenshot or the variable list of the Flow template used for the invite SMS (the names shown next to the placeholders in MSG91).
- Confirmation to go ahead and request the new variable-bearing WhatsApp template from MSG91.

## Technical notes

- Files touched: `supabase/functions/send-guardian-invite/index.ts` (Flow key names, WhatsApp components), no schema change, no new secrets.
- `guardian-invite-reminders` inherits both fixes automatically since it calls `send-guardian-invite`.
- Email invites already personalise correctly via the `guardian-invitation` template and need no change.
