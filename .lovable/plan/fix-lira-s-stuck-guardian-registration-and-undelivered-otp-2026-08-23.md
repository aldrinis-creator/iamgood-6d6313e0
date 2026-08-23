# Fix Lira’s stuck Guardian registration and undelivered OTP

## Confirmed findings

- Lira’s current nomination is valid and pending, and the stored invited number is **+91 99671 34652**.
- The stuck `+91 9` screen is caused by the invite form locking as soon as *any* phone text exists. The anonymous browser lookup of the protected guardian record cannot reliably prefill it; after the first typed digit, the condition `isInviteLink && phone` changes the editable field into a locked display.
- Recent OTP requests to the correct number were accepted by MSG91 and returned request IDs, but there is no delivery status recorded and the delivery webhook has received no callbacks. “Accepted by MSG91” therefore does not prove that WhatsApp or SMS reached the phone.

## Implementation

### 1. Make invite prefill reliable and prevent the stuck field

- Add a secure token-lookup action to the existing guardian nomination function. The nomination token will be validated server-side and only the minimum registration fields will be returned: guardian name, invited phone, nomination status, and expiry state.
- Replace the direct protected-table query in the registration page with this function call.
- Track invite loading, loaded, invalid, and expired states explicitly.
- Lock the phone only after a complete, valid invited number has loaded. Never lock a partially typed value.
- While lookup is in progress, show a loading state and keep “Next” unavailable. On lookup failure, show a retry action instead of silently presenting an editable/partially locked field.
- Normalize the returned phone to one canonical E.164 value before validation and OTP submission.

### 2. Repair OTP delivery observability

- Correct MSG91 response parsing so nested `data.request_id` is always stored; one recent accepted request currently lost that ID despite it being present in the response.
- Harden the existing delivery webhook to recognize MSG91 OneAPI/WhatsApp delivery payload field variants, normalize delivery states, and match reports by request ID.
- Authenticate the delivery webhook with a shared secret so delivery data cannot be forged.
- Log accepted, delivered, failed, and failure-reason states without logging OTP values.

### 3. Make the guardian OTP flow recoverable

- Keep the server-side nomination/phone match check so OTPs can only go to the number Aldrin invited.
- If MSG91 accepts a request but no delivery confirmation arrives, show a clear delayed-delivery state and allow a controlled resend after the cooldown rather than claiming the OTP was delivered.
- Ensure “Change number” returns to a usable screen; for an invite-bound number it will explain that Aldrin must correct and resend the nomination rather than exposing an unusable input.
- Preserve the nomination token through retry, app restart, and OTP verification.

### 4. Verify Lira end to end

- Test the registration link while signed out and confirm it renders the full locked number, never `+91 9`.
- Trigger one OTP to the correct invited number and confirm the stored request ID.
- Confirm either a delivered callback or a provider failure reason is recorded; do not report success based only on HTTP 200.
- Verify the OTP, create/link the Guardian account, accept the pending nomination, clear the saved token, and land on the Guardian dashboard.

## Technical scope

- Frontend: `src/pages/Register.tsx`, `src/components/OtpVerification.tsx`.
- Backend functions: `guardian-nomination-response`, `send-otp`, and `otp-delivery-webhook`.
- No new database table is required; the existing `otp_events` delivery fields will be used.
