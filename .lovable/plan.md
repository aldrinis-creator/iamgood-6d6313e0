# Switch WhatsApp OTP template to `verification_otp`

## What changes
The OTP WhatsApp message currently goes out on the old MSG91 template (`otp`). It will be sent on the new `verification_otp` template instead.

## Technical detail
- `supabase/functions/send-otp/index.ts`: change the WhatsApp template resolution from `Deno.env.get("MSG91_WA_OTP_TEMPLATE_NAME") ?? "otp"` to default to `"verification_otp"`.
- SMS (Flow API) delivery, OTP generation, hashing, rate limiting and verification logic stay untouched.
- Variable mapping stays the same: `body_1` = OTP code and `button_1_url` = OTP code (copy-code button).
- Language code stays `MSG91_WA_OTP_LANGUAGE ?? "en"`.
- Redeploy the `send-otp` function after the edit.

## Note
If the `verification_otp` template on MSG91 uses a different language code (e.g. `en_US`) or a different variable layout, tell me and I'll adjust the mapping.
