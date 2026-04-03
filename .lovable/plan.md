

## Fix OTP Functionality

### Problem Analysis

Two issues found:

1. **Wrong template ID**: The `MSG91_OTP_TEMPLATE_ID` secret needs to be set to the new value `69ce5a9bb83c239f890741f8`.

2. **OTP login doesn't actually sign the user in**: After OTP verification succeeds in `Login.tsx`, the code just navigates to `/dashboard` without creating an auth session. The user hits a protected route and gets bounced back to login. The flow needs to use Supabase's phone auth (`signInWithOtp` / `verifyOtp`) to create a real session, OR use a custom approach that signs the user in with their email+a server-generated token after MSG91 verification.

3. **Registration has no OTP verification**: Phone numbers are saved without verification during registration.

### Plan

#### Step 1 — Update the MSG91 OTP template ID secret
Set `MSG91_OTP_TEMPLATE_ID` to `69ce5a9bb83c239f890741f8`.

#### Step 2 — Fix the post-OTP-verification sign-in flow
After MSG91 verifies the OTP, the edge function needs to generate a Supabase auth session for the user. Approach:
- In the `send-otp` edge function, when `action === "verify"` succeeds, look up the user's email via `get_email_by_phone` DB function, then use the Supabase Admin API (`signInWithPassword` won't work without password) to generate a magic link or custom token.
- Better approach: Use `supabase.auth.admin.generateLink()` to create a one-time sign-in link, or return a short-lived session token.
- Simplest secure approach: After MSG91 OTP verification succeeds, the edge function calls `auth.admin.generateLink({ type: 'magiclink', email })` and returns the token. The client then uses `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` to establish the session.

#### Step 3 — Update `OtpVerification.tsx` and `Login.tsx`
- After successful OTP verify response from edge function, use the returned token/link to establish a real Supabase auth session.
- Handle the case where no account exists for the phone number (show "register first" message).

#### Step 4 — Deploy and test the updated edge function

### Files to modify
- `supabase/functions/send-otp/index.ts` — add post-verify auth token generation using Supabase admin client
- `src/components/OtpVerification.tsx` — pass back auth data from edge function response
- `src/pages/Login.tsx` — use returned auth data to establish session

### Secret update
- `MSG91_OTP_TEMPLATE_ID` → `69ce5a9bb83c239f890741f8`

