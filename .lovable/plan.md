## Plan — Send Pharmacy Order via MSG91 (User + Guardian)

Replace the `wa.me/...` deep link in **both** the User app (`RefillOrder.tsx`) and the Guardian app (`WardRefillOrder.tsx`) with an MSG91-powered server send, so the order is delivered to the pharmacy automatically without opening WhatsApp.

### How it will work

1. User/Guardian taps **"Send to Pharmacy via WhatsApp"**.
2. Frontend calls a new Edge Function `send-pharmacy-order` with `{ pharmacy_phone, order_text, patient_name, doctor_name, hospital_name, items_summary }`.
3. The Edge Function calls MSG91 Flow API with a pre-approved WhatsApp template (variables: patient name, doctor, hospital, items, date) and sends to the pharmacy number.
4. Frontend shows "Order sent to pharmacy" toast on success. If MSG91 returns an error, fall back to opening `wa.me/...` so the user is never blocked.

### Why a template is required

MSG91 / WhatsApp Business does **not** allow free-form outbound messages to numbers that haven't messaged you first. The pharmacy is a cold recipient, so this **must** go through a pre-approved WhatsApp template. You'll need to:

- Create a template in the MSG91 dashboard named e.g. `pharmacy_order` with these variables:
  - `{{1}}` patient name
  - `{{2}}` doctor name
  - `{{3}}` hospital/clinic
  - `{{4}}` date
  - `{{5}}` items list (multi-line)
- Submit it for WhatsApp approval (usually 1–24h).
- Once approved, paste the template ID — I'll store it as a new secret `MSG91_PHARMACY_TEMPLATE_ID`.

If you'd rather ship faster, we can use **SMS** via MSG91 instead of WhatsApp (no template approval needed for transactional SMS in many flows), but the message will arrive as plain SMS, not WhatsApp.

### Files

**New**

- `supabase/functions/send-pharmacy-order/index.ts` — validates input, calls MSG91 Flow API, returns `{ success, result }`.
- `supabase/config.toml` — add `[functions.send-pharmacy-order] verify_jwt = true` block (this should be authenticated since it's user-triggered).
- New secret: `MSG91_PHARMACY_TEMPLATE_ID`.

**Modified**

- `src/components/medications/RefillOrder.tsx` — `sendWhatsApp()` becomes async: calls `supabase.functions.invoke("send-pharmacy-order", ...)`, falls back to `wa.me` on failure.
- `src/components/WardRefillOrder.tsx` — same change, includes ward name in payload.

### What I need from you before building

1. **Channel**: WhatsApp template (preferred, requires approval) or plain SMS (faster, no approval)?
2. If WhatsApp: confirm you'll create the `pharmacy_order` template in MSG91 and provide the template ID, or want me to draft the exact template text for you to paste in.
3. Keep the `wa.me` **fallback** if MSG91 fails? (Recommended yes — pharmacies must always receive the order.)

1. WhatsApp channel
2. you may draft the template
3. keep the [wa.me](http://wa.me) fallback