
## Plan — Redeploy `send-sos-alert` and pull latest logs

You don't need the Supabase CLI or `cmd /c npx supabase functions deploy …`. Lovable Cloud has a built-in deploy tool that pushes the function directly to your managed backend (`magnrdegcegxdtgapyez`) without any login, link, or terminal.

### Steps

1. **Redeploy the edge function** using Lovable's `deploy_edge_functions` tool for `send-sos-alert`. This is the equivalent of the `npx supabase functions deploy …` you were trying to run, but it runs against the correct managed project automatically.
2. **Trigger an SOS in the app** (you do this from the preview — tap the SOS button with at least one accepted guardian on file).
3. **Fetch the latest `send-sos-alert` logs** so we can read:
   - `[send-sos-alert] WA request` — the exact payload sent to MSG91
   - `[send-sos-alert] WA response` — MSG91's reply (success / error reason)
   - `[send-sos-alert] SMS request` / `SMS response` — to diagnose why SMS isn't firing either
4. **Diagnose based on the logs:**
   - If WA request matches your curl exactly and MSG91 returns success → WhatsApp issue is resolved.
   - If MSG91 returns an error (e.g. template not approved on your integrated number, namespace mismatch, recipient not opted in) → I'll report the exact error and propose the next fix.
   - For SMS: confirm `MSG91_SOS_SMS_TEMPLATE_ID` is being read and what Flow API returns; if it's a template/Flow config issue I'll surface it.

### What I will NOT change in this step

- No code edits to `send-sos-alert/index.ts` — the hardcoded WhatsApp payload from the previous plan is already in place. This step is purely deploy + observe.
- SMS path stays as-is until logs tell us what's actually failing.

### Files touched

- None (deploy + log read only).

### Verification

- Deploy tool returns success for `send-sos-alert`.
- Logs show a `WA request` entry with `integrated_number: "917045868482"`, `template.name: "sos_alert_notification"`, and a populated `to_and_components` array.
- Logs show a `WA response` with either `type: "success"` + `request_id` (good) or a clear MSG91 error message (actionable).
- Guardian receives WhatsApp message; if not, the log error tells us exactly why.
