

## Fix: OTP Workflow and Build Errors in Register.tsx

### Problem

1. **Build error**: TypeScript reports `'title' does not exist` at 8 locations in `Register.tsx` — all are `toast.error()` / `toast.success()` calls. The code itself is correct sonner syntax, but the build system appears to be mis-resolving the `toast` type. This blocks the entire app.

2. **OTP registration flow**: During registration, the `send-otp` edge function's verify action tries to look up the user by phone (via `get_email_by_phone`) and returns `no_account: true` since the user doesn't exist yet. The current `handleOtpVerified` in Register ignores this, which is correct — BUT the edge function still wastes time trying to generate a magic link for a non-existent user.

3. **OTP login flow**: The Login page OTP flow depends on the edge function returning a `token_hash` after verification, then calling `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })`. This should work if the user exists and has a linked phone number in their profile.

### Fix Plan

**File: `src/pages/Register.tsx`**

The build error is likely caused by a stale TypeScript type cache conflicting with the sonner types. To force correct resolution, change the toast import to use the re-exported `toast` from the project's own `@/components/ui/sonner` module instead of directly from `"sonner"`:

```typescript
// Line 10: Change from
import { toast } from "sonner";
// To
import { toast } from "@/components/ui/sonner";
```

This is a known pattern that avoids TypeScript type resolution ambiguity with the sonner package. No other changes needed to the toast calls themselves — they are all valid.

**File: `supabase/functions/send-otp/index.ts`**

Add a quick-return path for the verify action when the purpose is registration (phone-only verification without session creation). This can be done by accepting an optional `purpose` field in the request body:

- When `purpose === "register"`, skip the user lookup and magic link generation after successful MSG91 OTP verification — just return `{ success: true, verified: true }`.
- When `purpose` is absent or `"login"`, keep the existing behavior (look up user, generate magic link, return `token_hash`).

**File: `src/components/OtpVerification.tsx`**

Add an optional `purpose` prop (default: `"login"`) and pass it to the edge function in the verify request body. This lets the Register page pass `purpose="register"` to skip unnecessary user lookup.

**File: `src/pages/Register.tsx` (OTP step)**

Pass `purpose="register"` to the `OtpVerification` component at step 3.

### Files to modify
- `src/pages/Register.tsx` — fix toast import, pass `purpose="register"` to OtpVerification
- `src/components/OtpVerification.tsx` — add `purpose` prop, include in verify request
- `supabase/functions/send-otp/index.ts` — handle `purpose=register` to skip session generation

