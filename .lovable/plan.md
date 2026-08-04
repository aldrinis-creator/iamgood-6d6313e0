# Switch four WhatsApp alerts to the new MSG91 templates

All four templates live in the new namespace `e67e5302_b6d0_403e_b3cc_8fa6e8accb01` on integrated number `917045868482`. The shared WhatsApp helper currently hardcodes the old namespace, so it gets an optional namespace override first.

## 1. Welcome message (new)

- New edge function `msg91-whatsapp-welcome`.
- Authenticated: validates the caller's token, reads their own profile (name + phone) server-side, so no phone can be spoofed.
- Sends `welcome_user`, language `en`, `body_1` = the member's first name (falls back to "there").
- Called from the registration flow right after signup completes and the session exists, for every new account (ward or guardian). Fire-and-forget: a failure never blocks or errors the signup.

## 2. Missed check-in alert to Guardian

- In `check-missed-checkins`, the guardian message switches from `guardian_missed_checkin` to `ward_missed_check_in`, language `en_GB`, new namespace.
- Variables stay as they are today: `body_1` = ward name, `body_2` = missed slot time (IST).
- The separate message to the ward (`user_missed_checkin`) is left untouched.

## 3. Missed medication alert to Guardian

- In `check-missed-medications`, the guardian message switches from `guardian_missed_medication` to `guardian_medication_reminder`, language `en_GB`, new namespace.
- Variables stay: `body_1` = ward name, `body_2` = list of missed medicines.
- The ward's own message (`user_missed_medication`) is left untouched.

## 4. Safe Zone return alert to Guardian

- `msg91-whatsapp-safezone-return` keeps the template name `safe_zone_return` but moves to the new namespace and language `en`.
- Template now takes two variables instead of three: `body_1` = ward name, `body_2` = safe zone name. The IST timestamp variable is dropped to match the new template.
- The caller in `useLocationSync.ts` keeps sending the same payload; the extra field is simply ignored.

## Technical notes

- `supabase/functions/_shared/msg91Whatsapp.ts` gains an optional `namespace` argument (defaults to the existing one) so per-template namespaces are supported without touching other senders.
- The new welcome function is added to `supabase/config.toml` with JWT verification enabled, and all touched functions are redeployed.
- No database or schema changes.

## Out of scope

- Templates not listed (SOS, OTP, safe-zone exit, safe-zone creation, pharmacy, appointment share) are unchanged.
