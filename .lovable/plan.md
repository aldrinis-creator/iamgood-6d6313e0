

## Update Welcome Email with Registration Details

### What Changes

Update the welcome email template and the trigger code to include the user's registration details and Check-iN contact information. Instead of sending the plaintext password (security risk), include a "Set Your Password" link.

### 1. Update Welcome Email Template
**File: `supabase/functions/_shared/transactional-email-templates/welcome.tsx`**

- Add new props: `phone`, `primaryGuardian`, `setPasswordUrl`
- Add an "Account Details" section showing:
  - User Name
  - Phone Number used for Registration
  - Primary Guardian Nominated (name + phone, or "None nominated yet")
  - A "Set Your Password" button/link (for phone-only users who got an auto-generated password)
- Add a "Check-iN Contact Details" section at the bottom:
  - Email: checkin_support@futurewave.in
  - Contact Center: +91 7045868482
- Update `previewData` with sample values

### 2. Pass Additional Data from Registration Trigger
**File: `src/contexts/AuthContext.tsx`** (welcome email trigger, ~line 62-71)

- After fetching the profile, also query the `guardians` table for the primary guardian (`is_primary = true`) for this user
- Pass `phone`, `primaryGuardian` (name + phone), and `setPasswordUrl` (password reset link) in `templateData`

### 3. Deploy
Redeploy `send-transactional-email` edge function after template update.

### Files to modify
- `supabase/functions/_shared/transactional-email-templates/welcome.tsx` — add account details + contact section
- `src/contexts/AuthContext.tsx` — pass phone, guardian, and set-password link in templateData

