# Guardian Invite End-to-End Test

Live test of the nomination + WhatsApp install flow.

- Ward account: +91 98195 76467 (Aldrin)
- Test guardian number: +91 99671 34652

## Steps

1. **Send the invite**
   Call the `send-guardian-invite` function for the ward with the test number, capturing the per-channel result (email, Flow SMS, WhatsApp `guardian_invite_app_downlaod`) and the generated nomination token.

2. **Check WhatsApp template status**
   Read the function logs and the MSG91 response for that send: template name, namespace, language, recipient, and the returned request/message ID plus any error code. Report whether the template was accepted, throttled, or rejected.

3. **Verify the invite row**
   Query the `guardians` row for the new invite: status, token, expiry, `reminder_count`, `install_confirmed_at`.

4. **Simulate install + acceptance (browser run)**
   Drive the install/accept page (`/install?g=<token>`) headlessly against the local preview, sign in as the guardian test identity, and complete the accept step. Capture screenshots at each stage.

5. **Confirm the result**
   Re-query the guardians row to confirm status is `accepted` and `install_confirmed_at` is set, and confirm the ward received the "guardian installed" notification.

## Notes

- This sends a real WhatsApp/SMS/email to the test number.
- If the guardian test number has no auth user yet, I will mint a session for the account created during accept, or create the guardian account through the normal sign-up path in the browser run.
- No code changes are planned; if a step fails I will report the exact failure and propose a fix before changing anything.
