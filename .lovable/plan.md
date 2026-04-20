

## Plan — Fix Admin 2FA: SMS + Email actually deliver

### Root causes found

1. **Email**: No verified email domain is configured for the project, so every send-transactional-email invoke is rejected by the email API with `403 no_matching_sender` and DLQ'd. The admin-2fa function's "success" log was misleading — it only checked if the invoke didn't throw, not actual delivery.
2. **SMS**: admin-2fa uses MSG91's legacy `/api/v5/otp` endpoint with the project's Flow template ID. That template was created for the Flow API (`/api/v5/flow`), so the OTP endpoint silently no-ops. The working `send-otp` function uses `/api/v5/flow` with `{ template_id, recipients: [{ mobiles, var1: code }] }`.
3. **Misleading audit metadata**: `sms:true` / `email:true` are recorded based on `!error` from invoke / `res.ok`, not actual MSG91 success body or queue delivery. Hides failures.

### Fixes

**1. Switch SMS to MSG91 Flow API** (`supabase/functions/admin-2fa/index.ts`)

Replace the `/api/v5/otp` call with the Flow API pattern that already works in `send-otp`:
```ts
const res = await fetch("https://control.msg91.com/api/v5/flow", {
  method: "POST",
  headers: { "Content-Type": "application/json", authkey: msg91Key, accept: "application/json" },
  body: JSON.stringify({
    template_id: otpTemplate,
    recipients: [{ mobiles: phoneDigits, var1: code }],
  }),
});
const json = await res.json().catch(() => ({}));
smsOk = res.ok && (json?.type === "success" || json?.message === "Request accepted");
```

Also log the response body when not OK so future failures are debuggable.

**2. Set up Lovable email domain + infrastructure**

The project has zero email domains configured, which is also why the broader app's transactional emails (welcome, SOS, guardian invites, etc.) would all fail. This is a one-time setup and benefits the entire app, not just admin 2FA.

I'll guide the user through the email setup dialog. Once DNS is verified, the existing `admin-2fa-code` template and queued sends will deliver automatically without any further code change.

**3. Honest success reporting** (admin-2fa)

Stop returning `success: true` on the send action when both channels failed. New behavior:
- If both SMS and email fail → return 502 with `{ error: "Could not deliver code via SMS or email", smsError, emailError }` so the AdminVerify page surfaces a real error instead of a fake "Code sent" toast.
- Audit metadata records the actual response details (status code + short error snippet), not just booleans.

**4. AdminVerify UX improvement**

When the send response includes `smsError` / `emailError`, show them in the existing error banner (already wired for `locked`). No layout change — just better surfacing of failures.

### Files

**Edit**
- `supabase/functions/admin-2fa/index.ts` — Flow API for SMS, real success detection, honest 502 on dual-failure, richer audit log.
- `src/pages/AdminVerify.tsx` — surface returned `smsError`/`emailError` text in the existing banner.

**Setup (interactive)**
- Email domain configuration dialog — one-time, benefits all transactional emails project-wide.

### Why this fixes it

- SMS will use the same working Flow API call that `send-otp` already uses successfully every day → real delivery to +91 7045868482.
- Once the email domain is verified, the `admin-2fa-code` template that's already queued and registered will start delivering to checkin_support@futurewave.in on the next queue cycle.
- Failures stop being silent: the AdminVerify page will tell you exactly which channel broke if anything regresses later.

### Out of scope

- Changing the email template content (already styled and registered correctly).
- Modifying the verify/validate flow (working as designed).
- Switching email providers (Lovable Emails is the right choice).

