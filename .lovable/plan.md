

## Plan — Wire up MSG91 Pharmacy Order Send

Template ID received: `e1e205a8_3b76_4c20_bde4_9f124a35c8c4`. Now building the send flow for both User and Guardian apps.

### Steps

1. **Add secret** `MSG91_PHARMACY_TEMPLATE_ID` with the value above (I'll prompt you to confirm).

2. **Create edge function** `supabase/functions/send-pharmacy-order/index.ts`:
   - Validates input (`pharmacy_phone`, `patient_name`, `doctor_name`, `hospital_name`, `order_date`, `items_text`).
   - Calls MSG91 Flow API with template ID from secret, mapping the 5 vars (`patient_name`, `doctor_name`, `hospital_name`, `order_date`, `items_list`).
   - Returns `{ success, result }` or error.
   - CORS enabled, JWT verified.

3. **Register function** in `supabase/config.toml`:
   ```
   [functions.send-pharmacy-order]
     verify_jwt = true
   ```

4. **Update `src/components/medications/RefillOrder.tsx`** — `sendWhatsApp()` becomes async:
   - Build items text (joined with `\n`).
   - Invoke `supabase.functions.invoke("send-pharmacy-order", { body: {...} })`.
   - On success → toast "Order sent to pharmacy via WhatsApp ✓".
   - On failure → fall back to existing `wa.me` deep link (no user blocking).

5. **Update `src/components/WardRefillOrder.tsx`** — same change, uses `wardName` as `patient_name`.

6. **Deploy** the new function.

### Files

**New:** `supabase/functions/send-pharmacy-order/index.ts`
**Modified:** `supabase/config.toml`, `src/components/medications/RefillOrder.tsx`, `src/components/WardRefillOrder.tsx`

### Fallback behavior (preserved)

If MSG91 returns an error or the secret is missing, the existing `wa.me/<phone>?text=<order>` flow opens automatically — pharmacy always receives the order one way or another.

