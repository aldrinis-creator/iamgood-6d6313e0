

## Add Phone Validation to OTP Login

### Change
In `src/pages/Login.tsx`, add validation to the OTP phone input so "Send OTP" is disabled until at least 10 digits are entered. Show an inline error message when the user clicks with insufficient digits.

### Implementation
- Extract digit count from `identifier` (strip non-digits)
- Disable the "Send OTP" button when digit count < 10
- Show a small red helper text ("Enter at least 10 digits") when the field has input but fewer than 10 digits
- Replace the plain `Input` with the `PhoneInput` component for consistency with the registration form

### File: `src/pages/Login.tsx`
- Import `PhoneInput` component
- In the OTP mode phone entry section (~line 155-180), swap `<Input>` for `<PhoneInput>` and add digit-count validation to the Send OTP button's `onClick` handler
- Add conditional helper text below the input

