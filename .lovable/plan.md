## Plan — MSG91 WhatsApp for "Share Appointment with Member/s"

### Diagnosis

`share-appointment-whatsapp` still calls the **MSG91 Flow API** (`/api/v5/flow`) — the same endpoint that silently failed for pharmacy orders. We already proved that the **WhatsApp Outbound Bulk API** is the correct one. We'll mirror the pharmacy pattern for appointments and define a new approved template.

---

### 1. New WhatsApp Template (you create in MSG91 dashboard)

**Template name:** `appointment_share_notification`
**Category:** Utility
**Language:** `en_US`
**Sender (integrated number):** `917045868482` (same as pharmacy)

**Body (5 positional variables):**

```text
Hi {{1}}, an appointment has been shared with you:

📅 *{{2}}*
🗓️ Date: {{3}}
⏰ Time: {{4}}
👨‍⚕️ Doctor: {{5}}

Sent via Check-iN.
```

Variable mapping:

- `{{1}}` = recipient name (member/guardian)
- `{{2}}` = appointment title
- `{{3}}` = date (e.g. `25 Apr 2026`)
- `{{4}}` = time (`HH:MM`)
- `{{5}}` = doctor name + (location appended in same line if present)

> Location is folded into `{{5}}` to keep the variable count at 5 (matching what MSG91 reliably approves quickly). Once you submit and approve, copy the **namespace** shown in the dashboard.

---

### 2. New / updated secrets (you add after template approval)

- `MSG91_APPT_SHARE_TEMPLATE_NAME` = `appointment_share_notification`
- `MSG91_APPT_SHARE_TEMPLATE_ID` = **already exists** — reuse this slot to store the **namespace** from the new approved template (replace its current value)
- *(reuse)* `MSG91_AUTH_KEY`, `MSG91_INTEGRATED_NUMBER`

I'll request these via `add_secret` after you confirm the template is approved.

---

### 3. Edge function rewrite — `supabase/functions/share-appointment-whatsapp/index.ts`

Mirror the working pharmacy function:

- Endpoint: `https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/`
- Headers: `Content-Type: application/json`, `authkey: <MSG91_AUTH_KEY>`
- Phone normalization (`91XXXXXXXXXX`)
- Single bulk call with `to_and_components[]` carrying ALL recipients (one entry per member, each with their own `body_1` = member name)
- Payload per recipient:
  ```text
  to: ["<normalized phone>"]
  components:
    body_1: <member_name>
    body_2: <appointment.title>
    body_3: <formatted date>
    body_4: <HH:MM>
    body_5: <doctor_name + ", " + location if present>
  ```
- Treat `type: "success"` or presence of request id as accepted → return `{ success: true, request_id }`
- On failure, return `{ success: false, error }` so client falls back to `wa.me`
- On success, update `appointments.share_status = 'shared'` (already in place)
- `verify_jwt = false` in `supabase/config.toml` (matches all MSG91 outbound functions)
- Early invocation log + full request/response logs

---

### 4. Client update — `src/components/appointments/ShareAppointmentDialog.tsx`

Tighten the existing handler:

- On `success: true` → toast `"Appointment shared via WhatsApp ✓"`, close dialog, invalidate `["appointments"]`
- On `success: false` or thrown error → automatically open the existing `wa.me` fallback per recipient (current behavior), toast `"MSG91 unavailable — opening WhatsApp manually"`
- Remove the unused `ExternalLink` import

No DB schema changes. No changes to `Appointments.tsx` (it already wires the dialog).

---

### Files modified

- `supabase/functions/share-appointment-whatsapp/index.ts` — full rewrite to WhatsApp Outbound API
- `supabase/config.toml` — set `verify_jwt = false` for `share-appointment-whatsapp`
- `src/components/appointments/ShareAppointmentDialog.tsx` — simpler success/fallback handling

### What you'll see

- Selected members receive the templated WhatsApp message on their number
- Edge function logs show full request/response for every share
- If MSG91 rejects (template paused, opted-out recipient, etc.), the dialog opens `wa.me` tabs so the appointment still gets shared manually
- Appointment row marked **Shared** in the Appointments list

### One thing for you to do (no code)

Create and submit `appointment_share_notification` in the MSG91 dashboard under integrated number `917045868482`, then share back the **namespace** so I can store it in `MSG91_APPT_SHARE_TEMPLATE_ID`.

curl --location --request POST

  '[https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/](https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/)'

  --header 'Content-Type: application/json'

  --header 'authkey: <authkey>'

  --data-raw '{

    "integrated_number": "917045868482",

    "content_type": "template",

    "payload": {

        "messaging_product": "whatsapp",

        "type": "template",

        "template": {

            "name": "appointment_share_notification",

            "language": {

                "code": "en",

                "policy": "deterministic"

            },

            "namespace": null,

            "to_and_components": [

                {

                    "to": [

                        "<list_of_phone_numbers>"

                    ],

                    "components": {

                        "body_1": {

                            "type": "text",

                            "value": "value1"

                        },

                        "body_2": {

                            "type": "text",

                            "value": "value1"

                        },

                        "body_3": {

                            "type": "text",

                            "value": "value1"

                        },

                        "body_4": {

                            "type": "text",

                            "value": "value1"

                        },

                        "body_5": {

                            "type": "text",

                            "value": "value1"

                        }

                    }

                }

            ]

        }

    }

}'

&nbsp;