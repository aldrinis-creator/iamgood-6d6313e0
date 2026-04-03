

## Add OTP Verification During Registration

### Current Flow
- Step 1: Role selection → Step 2: Personal details (name, phone, email, password) → Step 3: Guardian nomination (user role) or submit (guardian role)
- Phone is saved directly without verification

### Updated Flow
- Step 1: Role selection → Step 2: Personal details → **Step 2.5: OTP verification** → Step 3: Guardian nomination (user) or submit (guardian)
- After user fills in details and clicks Next, an OTP is sent to their phone via MSG91
- Phone is only accepted after successful OTP verification

### Changes

**`src/pages/Register.tsx`**
- Add new step constants: `TOTAL_STEPS_USER = 4`, `TOTAL_STEPS_GUARDIAN = 3`
- Add `phoneVerified` state flag
- In `handleDetailsNext`: instead of proceeding to step 3 or submitting, transition to an OTP verification step
- Render `OtpVerification` component when on the OTP step
- On successful verification, proceed to guardian nomination (user) or submit (guardian)
- Handle back navigation for the new step

**No edge function changes needed** — the existing `send-otp` function already handles send/verify and doesn't require an existing account (it just won't generate a session token for unregistered phones, which is fine during registration).

### Step-by-step
1. Increase total step counts by 1 for both roles
2. After details validation passes, go to new OTP step instead of next step / submit
3. Render `OtpVerification` on the OTP step with the formatted phone number
4. On OTP verified callback, mark phone as verified and proceed (step 3 for guardians = submit, step 4 for users = guardian nomination)
5. Update back button logic for the new step

