# Fix SOS WhatsApp template language mismatch

## What we found
- MSG91 rejects the SOS WhatsApp message: "sos_alert_notification does not exist in en_US".
- The current code sends the template with language `en` (not `en_US`), namespace `e67e5302_...`, and variables formatted as `body_var_1..4` with `parameter_name`. So the error means the live SOS function is probably still running an older version that asks for `en_US`, or the template's registered language/variable format doesn't match what the code sends. That's not confirmed yet.
- Other WhatsApp alerts use a shared helper with a different variable format (`body_1..4`). The SOS function builds its own request, so it can drift out of sync.

## Steps
1. **Confirm the real template setup**: ask MSG91 for the template list for number +91 70458 68482. Record the exact language code (`en`, `en_US` or `en_GB`), the namespace, and the variable names (numbered `{{1}}` or named `var_1`) for `sos_alert_notification`.
2. **Match the code to it** in the SOS alert function:
   - Set the language code to exactly what MSG91 reports.
   - Set the namespace MSG91 reports.
   - Send variables in the matching format: numbered → `body_1..body_4`; named → keep `body_var_N` with `parameter_name`.
   - Keep the four values: ward name, IST time, map link, health summary.
3. **Redeploy** the SOS alert function so the live version matches the code.
4. **Live test** to Tanisha (+91 81049 19135), then check that MSG91 shows it delivered, not just accepted. Mark the test SOS as resolved right away.
5. SMS, push, email, in-app alerts and the offline fallback stay as they are.

## If the template isn't approved in any language
Report back so the template can be approved in MSG91. The SMS alert keeps working in the meantime.
