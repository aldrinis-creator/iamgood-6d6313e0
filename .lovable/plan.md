

## Switch OTP Delivery from MSG91 OTP API to Flow API

### Why
The MSG91 OTP API (`/otp` endpoint) has been silently dropping messages. The Flow API (`/flow`) is the proven working endpoint — the same one used successfully for SOS alerts and other transactional SMS in this project.

### Key architectural change
The OTP API auto-generates and verifies OTPs server-side within MSG91. The Flow API does not — we must **generate, store, and verify OTPs ourselves** in the database.

### Changes

**1. Add OTP storage column to `otp_events` table** (migration)
- Add `otp_code text` column to store the generated OTP (hashed or plain, short-lived)
- Add `expires_at timestamptz` column for OTP expiry (e.g. 5 minutes)

**2. Rewrite `supabase/functions/send-otp/index.ts`**

- **Send/Resend flow**: Generate a random 6-digit OTP server-side, store it in `otp_events` with expiry, then call the Flow API:
  ```
  POST https://control.msg91.com/api/v5/flow
  {
    "template_id": "69d3566a15553530380a02f2",
    "recipients": [{ "mobiles": "919819576467", "var1": "123456" }]
  }
  ```
- **Verify flow**: Instead of calling MSG91's `/otp/verify`, query `otp_events` for the latest unexpired OTP matching the phone + code. Mark as verified. Then proceed with existing login (magic link) or registration logic unchanged.
- **Resend**: Generate a fresh OTP code, store it, send via Flow API again. No more `/otp/retry` endpoint needed.
- Rate limiting, logging, and auth session generation remain unchanged.

**3. No changes to client code**
- `OtpVerification.tsx`, `Login.tsx`, and `Register.tsx` remain untouched — the API contract (`action: send/resend/verify`, `phone`, `otp`, `purpose`) stays the same.

### Technical details

```text
Before (broken):
  Send:   GET/POST /otp?template_id=...&mobile=...  (MSG91 generates OTP)
  Verify: GET /otp/verify?otp=...&mobile=...         (MSG91 checks OTP)

After (Flow API):
  Send:   POST /flow { template_id, recipients: [{ mobiles, var1: generatedOTP }] }
  Verify: DB lookup — match phone + otp_code + not expired
```

### Files changed
- `supabase/functions/send-otp/index.ts` — rewrite send/resend/verify logic
- New migration — add `otp_code` and `expires_at` columns to `otp_events`

