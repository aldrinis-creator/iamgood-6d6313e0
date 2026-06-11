# Parallel SMS + WhatsApp OTP

Goal: When a user requests an OTP (registration, login, resend), deliver the same 6-digit code over **both** SMS (existing MSG91 Flow) and WhatsApp (MSG91 WhatsApp Outbound) at the same time. The OTP is generated once, stored once (hashed), and verification logic is unchanged — only delivery fans out.

## Backend changes

**`supabase/functions/send-otp/index.ts`**
1. After generating `otpCode`, fire two requests in parallel with `Promise.allSettled`:
   - **SMS:** existing MSG91 Flow call (unchanged).
   - **WhatsApp:** call the shared helper `sendWhatsAppTemplate` from `supabase/functions/_shared/msg91Whatsapp.ts` with:
     - `templateName` = `Deno.env.get("MSG91_WA_OTP_TEMPLATE_NAME")`
     - `languageCode` = `Deno.env.get("MSG91_WA_OTP_LANGUAGE") ?? "en_US"`
     - `recipients: [{ to: [phone], components: { body_1: otpCode } }]`
2. Success rule: as long as **at least one channel succeeds**, persist the OTP (hashed) via `logOtpEvent` and return `success: true` to the client. Include a small `channels` object in the response: `{ sms: "sent"|"failed", whatsapp: "sent"|"failed"|"skipped" }`.
3. If WhatsApp env vars are missing, skip WA silently (status `skipped`) — SMS-only fallback, no breakage.
4. Log each channel's status/failure_reason individually for observability (extend `logOtpEvent` or write a second `otp_events` row with `action = "send_wa"`).

**Secrets to add** (new):
- `MSG91_WA_OTP_TEMPLATE_NAME` — name of the MSG91-approved WhatsApp OTP template (with one body variable for the code).
- `MSG91_WA_OTP_LANGUAGE` — optional, defaults to `en_US`.

## Frontend changes

**`src/components/OtpVerification.tsx`**
- Copy: change "Enter the 6-digit code sent to **{phone}**" → "Enter the 6-digit code sent to **{phone}** via SMS and WhatsApp".
- Optional: if response includes `channels`, surface a small line ("Sent via SMS + WhatsApp" / "Sent via SMS only") under the input.

No changes to verification flow, rate limiting, OTP expiry, or DB schema.

## Out of scope
- No new tables, no migrations.
- No change to login magic-link flow or `purpose === "register"` branch.
- WhatsApp template must already be approved in MSG91 console — I'll prompt you to add the template name as a secret before deploying.

## Risks
- WhatsApp delivery requires the recipient to have an active WA account on that number; failures are silently downgraded (SMS still arrives).
- Sending two channels doubles MSG91 cost per OTP — acceptable per request.
