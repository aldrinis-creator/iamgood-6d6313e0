# WhatsApp confirmation when a User creates a Safe Zone

When a user saves a new Safe Zone, send them a WhatsApp confirmation on their own registered mobile number using the MSG91 template `safe_zone_creation_user`.

## Behaviour

- Fires only after the Safe Zone row is saved successfully.
- Goes to the user's own phone number (from their profile), not to guardians.
- The template carries no variables, so the message body is fixed text approved in the template.
- Sending is best-effort: if WhatsApp fails, the Safe Zone is still saved and no error is shown to the user.

## Technical details

New edge function `supabase/functions/msg91-whatsapp-safezone-created/index.ts`:

- Mirrors the existing `msg91-whatsapp-safezone` function (CORS, POST-only, `MSG91_AUTH_KEY` from secrets, phone normalisation to `91XXXXXXXXXX`).
- Validates the caller's JWT and resolves the phone number server-side from `profiles` for `auth.uid()` — the client does not pass a phone number.
- Posts to `https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/` with:
  - `integrated_number`: `917045868482`
  - template `safe_zone_creation_user`, language `en_US`, policy `deterministic`
  - namespace `e67e5302_b6d0_403e_b3cc_8fa6e8accb01` (note: different namespace than the existing `safe_zone` template)
  - `to_and_components`: single entry with the user's number and empty `components: {}`

Client change in `src/components/SafeZoneEditor.tsx`:

- In the `addZone` mutation's `onSuccess`, call `supabase.functions.invoke("msg91-whatsapp-safezone-created")` inside a try/catch that swallows errors.

No database or schema changes. No new secrets — `MSG91_AUTH_KEY` is already configured.

also inform the guardian