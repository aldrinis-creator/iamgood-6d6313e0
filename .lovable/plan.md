## Plan — Simple Admin Login (Admin ID + strict password) + dormant 2FA

Replace mandatory admin 2FA with a clean Admin ID + password login. Keep all 2FA infrastructure intact behind a feature flag so it can be re-enabled with one constant flip.

### Configuration choices

- **Admin ID**: Username only (e.g. `checkin_admin`) — stored internally as a synthetic email `<admin_id>@admin.checkin.local` so Supabase Auth handles credentials. Cleanest UX, no public exposure of the real support email.
- **Password rules**: Strict — minimum 12 chars, must include uppercase, lowercase, number, and symbol. Enforced client-side (zod) and server-side (edge function).
- **Lockout**: 5 failed attempts → 15-minute IP-scoped lockout, tracked in `admin_audit_log`.
- **2FA**: Kept as dormant feature flag. `ADMIN_2FA_ENABLED = false` in `AdminRoute`. All tables, edge function, verify page remain — flip the constant to re-enable.

### 1. Database (migration)

**New table — `admin_credentials**` (separate from auth.users for clarity):

- `id` uuid PK
- `admin_id` text UNIQUE NOT NULL — the username (e.g. `checkin_admin`)
- `user_id` uuid NOT NULL → references the synthetic auth.users row
- `created_at`, `last_login_at` timestamptz
- RLS: service_role only.

**New table — `admin_login_attempts**` (for IP rate-limiting):

- `id`, `admin_id` text, `ip` text, `success` boolean, `created_at`
- Used by the edge function to count failures in the last 15 min.
- RLS: service_role only.

**Seed**: No automatic admin creation. First-time setup happens via a one-time setup edge function (see below) — admin picks their own ID + password.

### 2. Edge function — `admin-auth`

Single function with three actions:

- `action: "setup"` — One-shot bootstrap. Only works if `admin_credentials` is empty. Validates `admin_id` (3-32 chars, alphanumeric + underscore) and password (zod strict rules). Creates synthetic auth user via service-role `auth.admin.createUser({ email: <admin_id>@admin.checkin.local, password, email_confirm: true })`. Inserts `admin_credentials` row + grants `admin` role in `user_roles`. Returns success.
- `action: "login", admin_id, password"` — Checks IP lockout (5 fails in 15 min → 429). Looks up synthetic email by `admin_id`. Calls `auth.signInWithPassword` server-side via anon client to validate creds. Logs attempt to `admin_login_attempts`. On success returns the session tokens for the client to set via `supabase.auth.setSession()`. On failure returns 401.
- `action: "change_password", current_password, new_password"` — Authenticated; re-validates current password, enforces strict rules on new one, calls `auth.admin.updateUserById`.

### 3. Frontend changes

**New page — `src/pages/AdminLogin.tsx**` at route `/admin/login`:

- Two-mode: **Setup** (shown only if no admin exists — checked via a tiny `admin-auth { action: "exists" }` call on mount) or **Login**.
- Form: Admin ID + password (with show/hide toggle). Strict-password helper text under the field.
- Submit → calls `admin-auth { action: "login" }`. On success, calls `supabase.auth.setSession(...)` with returned tokens, then navigates to `/admin/coupons`.
- Shows lockout banner when 429 received ("Too many failed attempts. Try again in 15 minutes.").
- Wrapped in `AppLayout` for branding consistency.

**New page — `src/pages/AdminSetup.tsx**` (optional separate route `/admin/setup`):

- Or fold into AdminLogin's setup mode — leaning toward the latter to keep it one route.
- Pick Admin ID + strong password. Real-time password strength meter (existing pattern can be borrowed from Register).

**Updated `src/pages/Login.tsx**`:

- Add a small **"Login as Admin"** link styled next to the existing "Register" link at the bottom of the form. Routes to `/admin/login`.

**Updated `src/components/AdminRoute.tsx**`:

- Add `const ADMIN_2FA_ENABLED = false;` at the top.
- When flag is `false`: skip the step-up token check entirely. Only verify `user` exists + has `admin` role → render children.
- When flag is `true`: existing 2FA logic kicks in (unchanged).
- All existing 2FA code paths preserved.

**Updated `src/App.tsx**`:

- Add public route `/admin/login` → `AdminLogin`.
- `/admin/verify` route stays (dormant, only used if flag flipped).

### 4. Files

**Create**

- Migration: `admin_credentials`, `admin_login_attempts` tables.
- `supabase/functions/admin-auth/index.ts` — setup, login, change_password, exists actions.
- `src/pages/AdminLogin.tsx` — combined setup/login UI.

**Edit**

- `src/components/AdminRoute.tsx` — add `ADMIN_2FA_ENABLED` flag, gate the 2FA block.
- `src/pages/Login.tsx` — add "Login as Admin" link next to "Register".
- `src/App.tsx` — register `/admin/login`.
- `supabase/config.toml` — add `[functions.admin-auth]` with `verify_jwt = false`.

**Untouched (kept dormant)**

- `admin-2fa` edge function, `admin_2fa_*` tables, `AdminVerify.tsx`, `admin-2fa-code` email template.

### Security properties

- **Synthetic email**: `<admin_id>@admin.checkin.local` is non-routable — can't be used for password reset spam or enumeration via signup.
- **Strict password enforced both client & server** (zod schema in edge function).
- **IP-scoped lockout**: 5 fails in 15 min blocks further attempts from that IP regardless of admin_id tried.
- **One-shot setup**: After first admin is created, setup mode is permanently disabled (returns 403).
- **No password reset flow exposed**: If admin loses password, recovery requires manual SQL access (acceptable for single-admin app; matches earlier 2FA recovery posture).
- **Audit log integration**: Login attempts also written to existing `admin_audit_log` for the future audit page.

### Re-enabling 2FA later

Single change: flip `ADMIN_2FA_ENABLED = true` in `AdminRoute.tsx`. Everything else (tables, edge function, verify page, email template) is already wired.  
  
Let app create an admin ID as `checkin_admin and let the admin cretae the password as defined and also enable 2FA for this account with full admin rights`

### Out of scope

- Multi-admin support.
- Self-service password reset.
- TOTP / authenticator apps.
- IP allowlisting (can layer on later).