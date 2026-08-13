# Global phone numbers for sign-up and WhatsApp OTP

Today the Create Account form offers only six country codes, and even if a non-Indian number is entered, the backend rewrites it into an Indian number before sending the WhatsApp OTP — so the code never arrives.

## What's wrong right now

1. `PhoneInput` has a hardcoded list of 6 countries (+91, +1, +44, +971, +65, +61).
2. Registration strips the leading `+` before verification (`phone.replace(/[\s\-\+]/g, "")`), so the country code becomes indistinguishable from a bare local number.
3. The OTP function's `normalizePhone` prefixes `91` to anything that doesn't start with `+` or `91`. A US number `14155551234` becomes `9114155551234`, which MSG91 cannot deliver to.
4. Validation demands "at least 10 digits", which rejects valid shorter national numbers (e.g. Singapore 8 digits, UAE 9 digits).

## What will change

**Country picker (global)**
- Replace the 6-entry list with a full country list (name, ISO code, flag, dial code) in a new `src/lib/countryCodes.ts`.
- Make the selector searchable (type country name or code) using the existing Command/Popover components, defaulting to India.
- Keep the same visual style so the auth screens are unchanged apart from the picker.

**Keep the country code intact end to end**
- Registration and login stop stripping `+`: the phone is passed and stored in E.164 form (`+<dial><number>`), spaces removed.
- Guardian phone fields use the same picker and same E.164 formatting.
- Login's `formatPhone` no longer assumes `+91` when a number has no prefix; it uses the picked country code.

**Validation per country**
- Accept 6–15 digits total (E.164 rule) instead of a flat 10-digit minimum, with the country code counted separately.

**Backend OTP delivery**
- `normalizePhone` in `send-otp` will trust an explicit country code (leading `+`) and only fall back to India when a bare 10-digit number is supplied. No more blind `91` prefixing.
- Same normalization applied to the phone-lookup RPC path used for login, so accounts created with a non-Indian number can still be found.
- WhatsApp dispatch keeps using the `verification_otp` template; MSG91 accepts international recipients as long as the number reaches it in full international form.

## Technical notes

- Files: `src/components/PhoneInput.tsx`, new `src/lib/countryCodes.ts`, `src/pages/Register.tsx`, `src/pages/Login.tsx`, `supabase/functions/send-otp/index.ts`.
- Existing Indian accounts are unaffected: numbers already stored as `91XXXXXXXXXX` continue to normalize to the same value.
- No database migration needed; phone values remain text.
- After the change I'll redeploy `send-otp` and probe it with a non-Indian test number to confirm the number is passed through unchanged.

## Not included

- Per-country phone-length validation tables (only the generic E.164 6–15 digit rule).
- SMS OTP fallback stays disabled, per the current WhatsApp-only decision.
