

## Plan — Pharmacy not receiving MSG91 WhatsApp message

### Diagnosis (confirmed from logs)

The edge function logs prove the pipeline works end-to-end:

```text
[send-pharmacy-order] calling MSG91 { mobile: "919819576467", template_id: "e1e205a8_3b76_4c20_bde4_9f124a35c8c4" }
[send-pharmacy-order] MSG91 response { status: 200, body: '{"message":"36647630536c79646371416e","type":"success"}' }
```

MSG91 returned `type: "success"` with a delivery request ID. **The app, the edge function, and the MSG91 API are all working correctly.** The message is being accepted by MSG91 — but not delivered to the pharmacy's WhatsApp.

This is a **MSG91 / WhatsApp delivery-side problem**, not an app problem. There are 3 known causes when MSG91 returns `success` but WhatsApp never arrives:

---

### Most likely root causes (in order)

**1. The template's variable names in MSG91 don't match what we send**

Our payload sends these recipient variables:
- `patient_name`, `doctor_name`, `hospital_name`, `order_date`, `items_list`

MSG91 silently drops messages when a required template variable is missing or misnamed. The template in your screenshot looks fine when *you* test it inside MSG91 — but MSG91's test UI uses different variable mapping than the Flow API. We need to confirm the **exact** variable names registered in the template's Flow definition.

**2. The pharmacy's WhatsApp number has not opted in / is blocked at WhatsApp Business**

WhatsApp Business API requires the recipient to either:
- Have messaged the business number in the last 24h, OR
- Receive only approved **template messages** (not session messages)

If the template was approved as a "Marketing" or "Authentication" category but is being sent to a number that opted out, WhatsApp silently drops it.

**3. Sender / WhatsApp Business Account (WABA) misconfiguration in MSG91**

The Flow may be configured against an SMS sender, not a WhatsApp sender. MSG91 returns `success` because the *Flow* was triggered, even if the underlying WhatsApp channel isn't wired.

---

### What I will do

**1. Add MSG91 delivery-status polling**
After getting the `request_id` (the `message` field MSG91 returns), call MSG91's report API:
```text
GET https://control.msg91.com/api/v5/report/{request_id}/wa
```
Log the actual delivery state (`sent`, `delivered`, `failed`, `rejected`, `template_mismatch`) so we can see *why* WhatsApp never arrived. This exposes the silent failure.

**2. Surface the real delivery state in the app**
Replace the current optimistic "Order sent via MSG91 ✓" toast with the actual MSG91 delivery state, polled 2–3s after send. If MSG91 reports `failed` or `rejected`, automatically open the WhatsApp fallback so the pharmacy still gets the order.

**3. Add a "Verify template" diagnostic call**
Add a one-time admin-only edge function `msg91-template-info` that calls:
```text
GET https://control.msg91.com/api/v5/wa/template/{template_id}
```
This returns the registered variable names. We compare them against what we send and fix any mismatch (e.g., MSG91 may expect `var1, var2, var3` instead of named keys, or the field could be `items` not `items_list`).

**4. Fix any variable mismatch found**
Once step 3 reveals the true variable schema, update `send-pharmacy-order` payload to match exactly.

**5. Document the pharmacy opt-in requirement**
If steps 1–4 show the message is `rejected` because the pharmacy hasn't opted in to your WhatsApp Business sender, add a one-line note in the Refill UI: *"First-time pharmacies must reply YES to the WhatsApp message from your sender to receive future orders."*

---

### Files to change

- **Modified:** `supabase/functions/send-pharmacy-order/index.ts` — poll delivery status, return real state
- **New:** `supabase/functions/msg91-template-info/index.ts` — one-off diagnostic
- **Modified:** `src/components/medications/RefillOrder.tsx` and `src/components/WardRefillOrder.tsx` — show real MSG91 delivery status, auto-fallback on confirmed failure

### What you'll see after the fix

- The toast/card will show one of: **"Delivered to pharmacy WhatsApp ✓"**, **"Sent to MSG91 — awaiting WhatsApp delivery"**, or **"MSG91 rejected — opening WhatsApp fallback"**.
- Edge function logs will show MSG91's actual delivery verdict (e.g., `template_param_mismatch`, `not_opted_in`, `delivered`).
- The pharmacy will receive the message either via MSG91 (once the variable / opt-in issue is resolved) or via the auto-opened WhatsApp fallback.

### Why this isn't fixable by code alone if cause is #2 or #3

If MSG91's report API confirms WhatsApp dropped the message due to opt-in or WABA setup, that requires a one-time action in the MSG91 dashboard (verify the sender is a WhatsApp sender, request opt-in from the pharmacy number). I'll surface the exact reason so you can take that action — but the fallback to manual WhatsApp will keep the pharmacy receiving orders in the meantime.

