

## Plan — Switch to MSG91 WhatsApp Outbound API (correct endpoint)

### Root cause (now confirmed)

The curl you shared reveals the real problem. We've been calling the **MSG91 Flow API** (`/api/v5/flow`) with named variables like `patient_name`, `items_list`. That endpoint is for SMS flows — not WhatsApp templates. MSG91 returns `type: "success"` because the Flow request is accepted, but no WhatsApp ever goes out because there's no WhatsApp channel wired to that endpoint.

The correct endpoint for WhatsApp templates is:
```text
POST https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/
```
with `integrated_number` (your WhatsApp Business number `917045868482`), template `name = medication_order_notification`, namespace `e1e205a8_3b76_4c20_bde4_9f124a35c8c4`, and **positional** body params `body_1` through `body_5`.

This explains everything: success response + no delivery + no error in MSG91 dashboard.

---

### What I'll change

**1. Rewrite `supabase/functions/send-pharmacy-order/index.ts`** to call the WhatsApp outbound endpoint exactly as in your curl:

- URL: `https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/`
- Headers: `Content-Type: application/json`, `authkey: <MSG91_AUTH_KEY>`
- Payload shape:
  ```text
  integrated_number: "917045868482"
  content_type: "template"
  payload:
    messaging_product: "whatsapp"
    type: "template"
    template:
      name: "medication_order_notification"
      language: { code: "en_US", policy: "deterministic" }
      namespace: "e1e205a8_3b76_4c20_bde4_9f124a35c8c4"
      to_and_components: [{
        to: ["<normalized pharmacy phone, e.g. 919819576467>"],
        components: {
          body_1: { type: "text", value: <patient_name> },
          body_2: { type: "text", value: <doctor_name> },
          body_3: { type: "text", value: <hospital_name> },
          body_4: { type: "text", value: <order_date> },
          body_5: { type: "text", value: <items_text, truncated to 900 chars> }
        }
      }]
  ```
- Keep phone normalization (`91XXXXXXXXXX`).
- Keep early invocation log + full request/response logs for visibility.
- Treat HTTP 2xx + `type === "success"` (or presence of a request id) as accepted; return `success: true` with the MSG91 request id.
- On non-2xx or explicit error in body, return `success: false` with the MSG91 error message so the client falls back to `wa.me`.

**2. Make the integrated number configurable**
Read `MSG91_INTEGRATED_NUMBER` from secrets, defaulting to `917045868482` (your number from the curl). If you ever change the WABA sender, you only flip a secret.

**3. Remove the obsolete delivery-poll against the SMS report URL**
The previous code polled `/api/v5/report/{id}/wa` — that endpoint isn't valid for the WhatsApp outbound API and was the source of the noisy "rejected" / "queued" toasts. Rely on the synchronous response from the outbound API plus a much shorter optional check against the WhatsApp report endpoint (`/api/v5/whatsapp/report/...`) only if it returns useful data; otherwise treat the synchronous accept as success.

**4. Client toast cleanup**
In `RefillOrder.tsx` and `WardRefillOrder.tsx`:
- On `success: true` → "Order sent to pharmacy via WhatsApp ✓" (close popup).
- On `success: false` → keep the existing automatic `wa.me` fallback (popup navigates to manual WhatsApp composer).
- Remove references to `delivery_state` / `delivery_failed` — no longer reported.

**5. Add a one-time secret check at deploy**
If `MSG91_AUTH_KEY` is missing, return a clear 200-with-error so the client falls back. (Already in place — keeping it.)

---

### Files modified

- `supabase/functions/send-pharmacy-order/index.ts` — full rewrite to the WhatsApp outbound API
- `src/components/medications/RefillOrder.tsx` — simplify success/failure handling
- `src/components/WardRefillOrder.tsx` — simplify success/failure handling

### Files added

- *(none — the existing `msg91-template-info` diagnostic stays as-is for future debugging)*

### What you'll see after the fix

- Pharmacy actually receives the WhatsApp template message on `+91 9819576467` (or whichever number the order was placed for).
- Edge function logs show the full WhatsApp outbound request + MSG91 response, so any future failure is diagnosable in one look.
- App toast: **"Order sent to pharmacy via WhatsApp ✓"** with the persistent "Pending Receipt" card showing **"Medications Received"**.
- If MSG91 ever rejects (e.g., template paused, sender suspended), the popup auto-navigates to `wa.me` so the order still gets to the pharmacy manually.

### One thing for you to confirm in the MSG91 dashboard (no code needed)

The template `medication_order_notification` (namespace `e1e205a8_3b76_4c20_bde4_9f124a35c8c4`) must be in **Approved** status under your `917045868482` integrated number, with exactly **5 body variables**. Your curl implies it already is — so no action needed unless delivery still fails after this fix.

