

## Make Registration Phone-First (Email Optional)

### Rationale
Check-iN targets elderly Indian users where phone is the primary digital identity. Following the pattern of Aarogya Setu, CoWIN, and major Indian apps — phone number becomes the primary identifier, email becomes optional.

### Changes

**1. Registration flow (`src/pages/Register.tsx`)**
- Remove `email` and `password` as required fields
- Add them as optional ("Add email for notifications" expandable section)
- Phone + OTP becomes the primary account creation method
- If email is provided, store it; if not, generate a placeholder email internally for Supabase auth (e.g., `+919876543210@phone.checkin.app`) since Supabase requires an email for the user record
- Password is only required if email is provided

**2. Login flow (`src/pages/Login.tsx`)**  
- Make "Sign in with Phone OTP" the primary/top option (swap order with Google)
- Move email/password login below as secondary option
- Keep Google sign-in as-is

**3. Auth context (`src/contexts/AuthContext.tsx`)**
- Add a `signInWithPhone` method that uses the existing OTP flow
- No changes to session management

**4. Database migration**
- Make `email` column nullable in profiles (if not already)
- Ensure `phone` column has a unique constraint

**5. Profile completion prompt**
- After phone-only registration, show a gentle prompt on dashboard: "Add your email to receive important alerts" — not blocking, just encouraging

### Login priority order (top to bottom)
1. Phone OTP (primary)
2. Google sign-in
3. Email + password (secondary)

### No changes to
- Guardian invitation flow (already uses phone)
- OTP edge function (already works)
- SOS/emergency flows (already phone-based)

