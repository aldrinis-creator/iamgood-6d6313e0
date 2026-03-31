

# MSG91 Integration for OTP, WhatsApp & Email Alerts

## Overview

Add MSG91 as a **primary messaging channel** alongside the existing Resend email + WhatsApp link system. MSG91 will handle SMS OTP verification, WhatsApp message delivery (via API, not browser links), and transactional emails.

## Prerequisites

You'll need to provide:
1. **MSG91 AuthKey** — from MSG91 Dashboard → API Keys
2. **MSG91 OTP Template ID** — for SMS/WhatsApp OTP verification
3. **MSG91 Flow Template IDs** — for SOS alerts, missed check-ins, medication alerts, and guardian invites (one template per alert type, created in MSG91 Dashboard → Flow)

## Architecture

```text
┌─────────────┐     ┌──────────────────────┐     ┌─────────┐
│  Frontend   │────▶│  Edge Functions       │────▶│  MSG91  │
│  (React)    │     │  (Supabase)           │     │  API    │
│             │     │                       │     │         │
│ Login/OTP   │     │ send-otp              │     │ OTP     │
│ SOS trigger │     │ send-sos-alert        │     │ Flow SMS│
│ Check-in    │     │ check-missed-checkins │     │ WhatsApp│
│             │     │ notify-guardian-med   │     │ Email   │
└─────────────┘     │ send-guardian-invite  │     └─────────┘
                    └──────────────────────┘
```

## Changes

### 1. New Edge Function: `send-otp` (SMS OTP via MSG91)
- Sends OTP using MSG91's SendOTP API: `https://control.msg91.com/api/v5/otp`
- Verify OTP endpoint: `https://control.msg91.com/api/v5/otp/verify`
- Resend OTP endpoint: `https://control.msg91.com/api/v5/otp/retry`
- Used during registration and login for phone verification

### 2. New Edge Function: `msg91-send` (Shared MSG91 helper)
- Generic function to send WhatsApp/SMS/Email via MSG91 Flow API (`https://control.msg91.com/api/v5/flow`)
- Accepts `{ channel, template_id, recipients, variables }` 
- Used by all other edge functions as a helper

### 3. Update Existing Edge Functions (add MSG91 alongside Resend)
Each function gets a MSG91 WhatsApp/SMS send after the existing Resend email send:

| Function | MSG91 Addition |
|----------|---------------|
| `send-sos-alert` | Send WhatsApp alert to guardians via Flow API (replaces browser `wa.me` links) |
| `check-missed-checkins` | Send WhatsApp notification to guardians |
| `notify-guardian-medication` | Send WhatsApp for missed medication |
| `send-guardian-invite` | Send WhatsApp invite via Flow API |

### 4. Frontend: OTP Verification Flow
- Add OTP input step to Registration page (after email/password signup)
- Add OTP verification option on Login page (phone + OTP as alternative to password)
- New component: `OtpVerification.tsx` — 6-digit input with resend timer

### 5. Frontend: Remove browser WhatsApp links
- Update `SOSDialog.tsx`, `FallDetectionOverlay.tsx`, `RefillOrder.tsx`, `WardRefillOrder.tsx` to call edge functions for WhatsApp delivery instead of opening `wa.me` links
- Keep `wa.me` links as fallback if MSG91 call fails

## Secrets Required

| Secret Name | Purpose |
|-------------|---------|
| `MSG91_AUTH_KEY` | MSG91 authentication key |
| `MSG91_OTP_TEMPLATE_ID` | Template ID for OTP messages |
| `MSG91_SOS_TEMPLATE_ID` | Flow template ID for SOS alerts |
| `MSG91_CHECKIN_TEMPLATE_ID` | Flow template ID for missed check-in alerts |
| `MSG91_MED_TEMPLATE_ID` | Flow template ID for medication alerts |
| `MSG91_INVITE_TEMPLATE_ID` | Flow template ID for guardian invites |

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/send-otp/index.ts` | **New** — OTP send/verify/resend via MSG91 |
| `supabase/functions/msg91-send/index.ts` | **New** — shared MSG91 Flow API helper |
| `supabase/functions/send-sos-alert/index.ts` | Add MSG91 WhatsApp send alongside Resend |
| `supabase/functions/check-missed-checkins/index.ts` | Add MSG91 WhatsApp send |
| `supabase/functions/notify-guardian-medication/index.ts` | Add MSG91 WhatsApp send |
| `supabase/functions/send-guardian-invite/index.ts` | Add MSG91 WhatsApp/SMS send |
| `src/components/OtpVerification.tsx` | **New** — OTP input component |
| `src/pages/Register.tsx` | Add OTP verification step after signup |
| `src/pages/Login.tsx` | Add phone+OTP login option |
| `src/components/SOSDialog.tsx` | Call edge function for WhatsApp instead of `wa.me` |
| `src/components/FallDetectionOverlay.tsx` | Remove direct `wa.me` opens, rely on edge function |
| `supabase/config.toml` | Add `verify_jwt = false` for `send-otp` and `msg91-send` |

## Implementation Order

1. Add MSG91 secrets (AuthKey first, template IDs after you create them in MSG91 dashboard)
2. Create `msg91-send` edge function
3. Create `send-otp` edge function
4. Update existing alert edge functions
5. Build OTP verification component
6. Update Login/Register pages
7. Update SOS/Fall detection to use server-side WhatsApp

