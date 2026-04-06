

## Fix: MSG91 SOS Template Integration

### Problem
The current `send-sos-alert` edge function uses `MSG91_SOS_TEMPLATE_ID` from env vars and sends `user_name` + `message` as recipient variables. The actual MSG91 SOS template (ID: `69cff9f7759afeb3920ace04`) expects only `var1` (the user's name).

### Changes

**File: `supabase/functions/send-sos-alert/index.ts` (lines 265-291)**

1. Hardcode the SOS template ID `69cff9f7759afeb3920ace04` instead of reading from `MSG91_SOS_TEMPLATE_ID` env var — removes a configuration dependency
2. Update recipient object to use `var1` instead of `user_name` and `message`, matching the template's expected variables:
   ```typescript
   recipients = guardianPhones.map(phone => ({
     mobiles: mobile,
     var1: user_name || "User"
   }));
   ```
3. Keep `MSG91_AUTH_KEY` from env (already configured) — the authkey in the curl is `309253AO6oDwIMaR5dfcbea2P1` which should match the stored secret

### Files to modify
- `supabase/functions/send-sos-alert/index.ts` — update MSG91 section (~5 lines changed)

