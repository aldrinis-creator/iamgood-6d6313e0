

# Add Phone Number Sign-In to Login Page

## Problem
The Login page only supports email+password and Google OAuth. Since this is an Indian-market app where phone numbers are primary identifiers, users should be able to sign in with their phone number too.

## Approach
Since Supabase auth is email-based and we're skipping OTP, the strategy is:
- Let users enter **either** email or phone number in a single field
- Auto-detect if input is a phone number (starts with digits or +)
- If phone: look up the associated email from the `profiles` table, then use that email for `signInWithPassword`
- If email: sign in directly as before

No database changes needed — the `profiles` table already stores phone numbers.

## Changes

### 1. `src/pages/Login.tsx`
- Change the email field to an "Email or Phone" field
- Add detection logic: if input matches phone pattern, query `profiles` table by phone to get the email
- Prepend `+91` automatically if user enters a bare number (Indian market default)
- Sign in using the resolved email + password
- Show clear error if phone number not found in system

### 2. `src/pages/Login.tsx` — Forgot Password view
- Keep email-only for password reset (reset links require email)
- Add helper text: "Enter the email associated with your account"

## Technical Detail

```text
User enters "9876543210" + password
  → detect as phone → prepend "+91" → query profiles where phone = "+919876543210"
  → get email from profile row → signInWithPassword(email, password)
  → if no profile found → "No account found with this phone number"
```

