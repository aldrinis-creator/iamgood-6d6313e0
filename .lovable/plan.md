# Personalised WhatsApp guardian invite

Make the `guardian_invite_app_downlaod` template carry real values instead of empty `components: {}`.

## Values sent

| Variable | Value |
|---|---|
| body_1 | guardian_name (e.g. "Lira Alphonso") |
| body_2 | user_name — the ward nominating them |
| body_3 | relation (e.g. "Daughter"; blank-safe fallback "Guardian") |
| body_4 | install_link — `https://iamgood.lovable.app/install?g=<nomination_token>` |

The install link carries the nomination token, so the guardian installs the app and lands straight in the accept flow tied to the right ward.

## Changes

- `supabase/functions/_shared/msg91Whatsapp.ts`: extend `WaComponents` with `body_4` and map it in `componentsToObject` as `{ type: "text", value }`. Also keep `button_1_url` support in case the template's link is a dynamic URL button rather than a body variable.
- `supabase/functions/send-guardian-invite/index.ts`: replace `components: {}` with the four values above, using the already-computed `installLink` and the sanitised relation text (without the surrounding parentheses used in email/SMS).
- No change needed to `guardian-invite-reminders` — it calls this function, so reminders become personalised too.
- No schema change, no new secrets.

## One check after deploy

Send a test invite and read the MSG91 response in the function logs. If MSG91 rejects with a component-count/param error, the template's 4th value is a URL button rather than a body variable — in that case the same edit switches `body_4` to `button_1_url` with the identical link.
