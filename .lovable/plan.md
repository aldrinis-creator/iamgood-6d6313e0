# MSG91 Integration — Completed

MSG91 integrated for OTP, WhatsApp alerts, and transactional messaging alongside existing Resend email system.

## What was done

1. **New edge functions**: `send-otp` (OTP send/verify/resend) and `msg91-send` (shared Flow API helper)
2. **Updated edge functions**: `send-sos-alert`, `check-missed-checkins`, `notify-guardian-medication`, `send-guardian-invite` — all now send MSG91 WhatsApp alerts alongside existing email/push
3. **New component**: `OtpVerification.tsx` — 6-digit OTP input with resend timer
4. **Login page**: Added "Sign in with OTP" option (phone + MSG91 OTP)
5. **SOS/Fall detection**: Server-side WhatsApp via MSG91, with wa.me fallback if MSG91 is not configured

## Secrets configured
- MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID, MSG91_SOS_TEMPLATE_ID, MSG91_CHECKIN_TEMPLATE_ID, MSG91_MED_TEMPLATE_ID, MSG91_INVITE_TEMPLATE_ID
