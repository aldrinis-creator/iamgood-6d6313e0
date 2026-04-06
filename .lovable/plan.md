

## Fix: Update MSG91 OTP Template ID

### Root Cause
MSG91 returns `type: "success"` even when a template ID is invalid or doesn't match the account — but never actually sends the SMS. The stored `MSG91_OTP_TEMPLATE_ID` secret has the wrong value. The correct template ID confirmed by the user is `69d3566a15553530380a02f2`.

### Fix
1. **Update the `MSG91_OTP_TEMPLATE_ID` secret** to `69d3566a15553530380a02f2` using the secrets tool.
2. **Send a test OTP** to `919819576467` to confirm SMS is received.
3. **Query `otp_events`** to verify the delivery webhook fires.

### Why This Was Missed
MSG91's API misleadingly returns `{"type":"success","request_id":"..."}` even when the template ID is wrong — it silently drops the message. The empty Logs page in MSG91 dashboard is the proof.

### No Code Changes Required
Only the secret value needs updating. All edge function code is correct.

