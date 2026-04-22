

## Plan — Wire `send-sos-alert` to MSG91 WhatsApp Outbound API

### Confirmed inputs
- Template: `sos_alert_notification` (approved, 4 body vars, `en_US`)
- Namespace: `e1e205a8_3b76_4c20_bde4_9f124a35c8c4`
- Sender: `917045868482`
- Secret slot already exists: `MSG91_SOS_TEMPLATE_ID` → I'll ask you to update its value to the namespace above

### What changes

**1. Secret update (you do this)**
- Set `MSG91_SOS_TEMPLATE_ID` = `e1e205a8_3b76_4c20_bde4_9f124a35c8c4`
- Set `MSG91_INTEGRATED_NUMBER` = `917045868482` (if not already)

**2. Edge function rewrite — `supabase/functions/send-sos-alert/index.ts`**

Replace the existing MSG91 Flow API block (lines ~213-241) with a WhatsApp Outbound Bulk API call, mirroring the proven pharmacy/appointments pattern:

- Endpoint: `https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/`
- Headers: `Content-Type: application/json`, `authkey: <MSG91_AUTH_KEY>`
- Build `to_and_components[]` — one entry per guardian phone, each with:
  - `body_1` = ward name (`user_name`)
  - `body_2` = IST timestamp (formatted via existing pattern)
  - `body_3` = Google Maps link from `sos_events.lat/lng` (latest active SOS) OR `"Location unavailable"`
  - `body_4` = compact health summary from `medical_info` table (blood group + key conditions, truncated to ~200 chars) OR `"See app for details"`
- Treat `type: "success"` or presence of `request_id` → `msg91Sent = recipients.length`
- On failure, log full response; in-app + email + push paths remain unchanged
- Phone normalization: strip non-digits, prepend `91` if missing
- Deduplicate recipients by phone

**3. Data fetch additions inside the function**
- Query latest active `sos_events` row for `user_id` to get `lat`/`lng` for `body_3`
- Query `medical_info` for `user_id` to build `body_4` (blood_group, conditions array, allergies — truncated)
- Both wrapped in try/catch with safe fallbacks so SOS never blocks on enrichment failures

**4. No changes to**
- `supabase/config.toml` (already `verify_jwt = false`)
- Email queue, push notification, in-app notification logic
- Any client code (`SOSDialog`, `FallDetectionOverlay`, `AppContext.triggerSOS`) — they already invoke `send-sos-alert`

### Files modified
- `supabase/functions/send-sos-alert/index.ts` — replace Flow API block with WhatsApp Outbound Bulk API

### What you'll see after deploy
- Real WhatsApp message arrives on every guardian's phone within seconds of SOS
- Function logs show full request payload + MSG91 response with `request_id`
- Existing email + push + in-app + `wa.me` fallback paths unaffected

### What you do
1. Update secret `MSG91_SOS_TEMPLATE_ID` to `e1e205a8_3b76_4c20_bde4_9f124a35c8c4`
2. Approve this plan — I'll deploy the rewritten function

