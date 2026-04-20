

## Plan — Admin login with step-up 2FA (SMS + Email)

A two-layer admin gate. Normal Supabase login first, then a mandatory 6-digit code sent to **both** the fixed admin SMS (+91 7045868482) and email (checkin_support@futurewave.in) before any `/admin/*` route loads. 30-min inactivity TTL. Seeded via migration so the admin role and 2FA contacts are pre-configured.

### 1. Database (migration)

**New table — `admin_2fa_config`** (single source of truth for admin contacts):
- `id` uuid PK
- `phone` text NOT NULL — `+917045868482`
- `email` text NOT NULL — `checkin_support@futurewave.in`
- `created_at` timestamptz default `now()`
- RLS: only `service_role` can read.

**New table — `admin_2fa_codes`** (short-lived OTPs):
- `id` uuid PK
- `user_id` uuid NOT NULL (the admin attempting access)
- `code_hash` text NOT NULL (SHA-256 of the 6-digit code — never store plaintext)
- `channel` text NOT NULL (`sms` or `email`) — one row per channel so either code works
- `expires_at` timestamptz NOT NULL (now + 5 min)
- `consumed_at` timestamptz nullable
- `attempts` integer default 0 (lock after 5)
- `created_at` timestamptz default `now()`
- RLS: only `service_role`.

**New table — `admin_audit_log`** (security trail):
- `id`, `user_id`, `action` (`login_attempt`, `2fa_sent`, `2fa_verified`, `2fa_failed`, `admin_route_access`), `ip`, `user_agent`, `metadata` jsonb, `created_at`
- RLS: only `service_role` writes/reads (admins view via the page, fetched through the edge function).

**Seeding (idempotent)**:
- Insert the fixed config row.
- Find `auth.users` whose email matches `checkin_support@futurewave.in` OR profile phone matches `+917045868482`, and grant them `admin` role in `user_roles` via `ON CONFLICT DO NOTHING`. If neither exists yet, the migration is still safe — admin role gets granted on next signup via a small trigger that checks the same conditions.

**Cleanup cron**: hourly `DELETE FROM admin_2fa_codes WHERE created_at < now() - interval '1 hour'`.

### 2. Edge function — `admin-2fa`

Single function with three actions (mirrors `admin-coupons` auth pattern):

- `action: "send"` — Validates JWT + admin role, generates a 6-digit code, hashes it, inserts two rows in `admin_2fa_codes` (one per channel), then:
  - SMS via existing MSG91 Flow API to `+917045868482` (uses `MSG91_OTP_TEMPLATE_ID` — already wired).
  - Email via `send-transactional-email` with a new `admin-2fa-code` template to `checkin_support@futurewave.in`.
  - Logs `2fa_sent` to audit log.
- `action: "verify", code` — Hashes input, looks up matching unconsumed unexpired row, marks consumed, returns a `step_up_token` (random 32-byte hex) + `expires_at = now() + 30 min` stored in a new `admin_step_up_tokens` table. Logs result. Lockout after 5 failed attempts in 10 min.
- `action: "validate", token` — Used by `AdminRoute` to confirm the token is still valid + sliding window: each successful validate extends `expires_at` by 30 min (inactivity TTL).

JWT validation in code (`verify_jwt = false` in config.toml + manual `auth.getUser()` check, same pattern as `admin-coupons`).

### 3. Frontend changes

**Updated `AdminRoute.tsx`** (`src/components/AdminRoute.tsx`):
- After confirming `isAdmin === true` from `user_roles`, also check `sessionStorage.getItem('admin_step_up_token')`.
- If missing → redirect to `/admin/verify?next=<original-path>`.
- If present → call `admin-2fa { action: "validate", token }`. On success, render children + refresh stored token. On failure (expired/invalid), clear storage and redirect to `/admin/verify`.
- Logs `admin_route_access` server-side via the validate call.

**New page — `src/pages/AdminVerify.tsx`** at route `/admin/verify`:
- Auto-fires `admin-2fa { action: "send" }` on mount (with 60s resend cooldown).
- Shows masked destinations: `SMS to +91 ******8482` and `Email to ch***@futurewave.in`.
- 6-digit `InputOTP` (reuses existing `src/components/ui/input-otp.tsx`).
- "Verify" button → calls `admin-2fa { action: "verify", code }`. On success, stores `step_up_token` in `sessionStorage` and navigates to `?next=` path (defaults to `/admin/coupons`).
- "Resend code" with countdown.
- After 5 failed attempts → lockout banner ("Locked for 10 minutes — contact support").
- Wrapped in `AppLayout` for consistency.

**New email template — `admin-2fa-code.tsx`** (`supabase/functions/_shared/transactional-email-templates/`):
- Same Check-iN navy branding as existing templates.
- Subject: "Your admin verification code"
- Body: large monospace 6-digit code, 5-min expiry warning, "if you didn't request this, contact support immediately" footer.
- Registered in `registry.ts`.

**Logout cleanup** (`AuthContext.signOut`):
- Add `sessionStorage.removeItem('admin_step_up_token')` to the existing signOut handler so re-login forces fresh 2FA.

**`config.toml`**:
- Add `[functions.admin-2fa]` block with `verify_jwt = false` (we validate manually).

### 4. Admin audit log page (small bonus, same pattern)

Optional but cheap — extend the future admin nav so audit entries are inspectable:
- New route `/admin/audit` (also `AdminRoute`-gated → 2FA-gated).
- Page lists last 200 audit rows via a new `admin-audit { action: "list" }` edge function (service-role read).
- Defer if you don't want it — say the word and I'll drop it from the build.

### Files

**Create**
- Migration: 3 tables + cleanup cron + seed + role-grant trigger.
- `supabase/functions/admin-2fa/index.ts`
- `supabase/functions/_shared/transactional-email-templates/admin-2fa-code.tsx`
- `src/pages/AdminVerify.tsx`
- (optional) `supabase/functions/admin-audit/index.ts` + `src/pages/AdminAudit.tsx`

**Edit**
- `src/components/AdminRoute.tsx` — step-up token check + validate call.
- `src/contexts/AuthContext.tsx` — clear step-up token on signOut.
- `src/App.tsx` — add `/admin/verify` (and `/admin/audit` if including).
- `supabase/config.toml` — register `admin-2fa` (and `admin-audit`).
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register new template.

### Security properties

- **Two-factor for real**: even if attacker compromises Supabase password, they need access to either `+91 7045868482` (your phone) or `checkin_support@futurewave.in` (your inbox).
- **Codes hashed at rest** — DB leak doesn't expose live codes.
- **Lockout**: 5 failed attempts → 10-minute block per user.
- **Inactivity expiry**: 30 min sliding window; closing tab → re-verify next session.
- **Full audit trail** of every admin action.
- **Fixed contacts**: 2FA always goes to your phone/email regardless of which account is used — even if a malicious admin role were inserted, codes go to you.

### Edge cases handled

- **You change your phone/email later**: update the single row in `admin_2fa_config` via SQL — no code change.
- **MSG91 outage**: email still works (you only need ONE of the two codes).
- **Email outage**: SMS still works.
- **Lost both**: no recovery path by design — for a single-admin app this is acceptable. Recovery would require manual SQL access to clear lockout.

### Out of scope

- TOTP authenticator app — overkill for one admin.
- Multi-admin support / per-user 2FA contacts.
- IP allowlisting (can be added later via the audit log).
- Recovery codes (flagged above — single-admin, intentional).

