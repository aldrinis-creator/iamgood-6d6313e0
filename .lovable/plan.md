

## Plan — Switch ambulance edge function to MSG91 WhatsApp Bulk API (approved templates)

The two MSG91 templates are now approved and use the **WhatsApp Bulk API** with positional `body_N` slots, not the Flow API's named keys. The edge function must be rewritten to call the new endpoint with the correct payload, otherwise sends will fail.

### 1. Endpoint and payload changes — `supabase/functions/send-ambulance-request/index.ts`

Replace both MSG91 calls. Constants update:

```
MSG91_WA_BULK_URL  = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
MSG91_INTEGRATED_NUMBER = "917045868482"
MSG91_NAMESPACE    = "e1e205a8_3b76_4c20_bde4_9f124a35c8c4"
```

Replace `sendWhatsAppViaMsg91()` (dispatch) with a Bulk API call that sends to **+918710810887** using template `ambulance_dispatch_request`, with positional bodies in this exact order matching the approved template:

| Slot | Value |
|---|---|
| `body_1` | `patient_name` |
| `body_2` | `pickup_address` (or `lat,lng` fallback) |
| `body_3` | `destination` |
| `body_4` | `user_phone` |
| `body_5` | `guardian_phone` (or `—`) |
| `body_6` | `health_summary` (≤200 chars) |
| `body_7` | `profile_link` |
| `body_8` | `ambulance_type` (`BLS`/`ALS`) |

Replace the guardian-notify fetch in `notifyGuardians()` with a Bulk API call to the primary guardian's phone using template `ambulance_guardian_notify`:

| Slot | Value |
|---|---|
| `body_1` | `ward_name` |
| `body_2` | `pickup` |
| `body_3` | `destination` |
| `body_4` | `request_id` (first 8 chars) |

Note: `ambulance_type` is **not** in the approved guardian template (only 4 slots), so the guardian message will not show the type — that matches what MSG91 approved. Confirming with you that this is intentional.

Both calls use this exact request shape:

```json
{
  "integrated_number": "917045868482",
  "content_type": "template",
  "payload": {
    "messaging_product": "whatsapp",
    "type": "template",
    "template": {
      "name": "<template_name>",
      "language": { "code": "en_GB", "policy": "deterministic" },
      "namespace": "e1e205a8_3b76_4c20_bde4_9f124a35c8c4",
      "to_and_components": [{
        "to": ["<phone>"],
        "components": {
          "body_1": { "type": "text", "value": "<v1>" },
          "body_2": { "type": "text", "value": "<v2>" },
          "...": "..."
        }
      }]
    }
  }
}
```

Headers: `Content-Type: application/json` + `authkey: <MSG91_AUTH_KEY>`.

### 2. Secrets — already configured

- `MSG91_AUTH_KEY` ✅ exists
- `MSG91_AMBULANCE_TEMPLATE_ID` and `MSG91_AMBULANCE_GUARDIAN_NOTIFY_TEMPLATE_ID` are **no longer needed** — the Bulk API uses the **template name** (`ambulance_dispatch_request`, `ambulance_guardian_notify`), not template IDs. These secrets become dead and can be removed later (no action needed now).

### 3. What I will NOT change

- No DB schema change.
- No UI change in `AmbulanceBooking.tsx`.
- No change to the in-app + push guardian notifications, only the WhatsApp leg.
- No change to other MSG91 flows (OTP, SOS, etc.) — they continue to use the Flow API as before.

### Verification after deploy

1. Trigger a test ambulance request from the User app.
2. `+918710810887` should receive the dispatch WhatsApp with all 8 fields.
3. Primary guardian's number should receive the 4-field notify WhatsApp.
4. `supabase.edge_function_logs("send-ambulance-request")` will show the Bulk API response JSON for both calls.

