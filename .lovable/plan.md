

## Plan — Fix Pharmacy WhatsApp 404 + MSG91 Send Confirmation

### Screenshot diagnosis

The screenshot shows WhatsApp opened, but landed on `api.whatsapp.com` with **404 — This page doesn't exist**. That means the fallback is no longer fully blocked; it is opening a WhatsApp URL that WhatsApp rejects.

The most likely cause is phone formatting: the app strips symbols but does **not** convert a 10-digit Indian number into international WhatsApp format. For example:

```text
9876543210   -> currently sent as 9876543210
Required     -> 919876543210
```

I also checked backend function logs for `send-pharmacy-order`: there are currently **no logs**, which means the MSG91 function is either not deployed/reached, blocked before execution, or not being invoked from the current app session.

---

## What I will build

### 1. Fix WhatsApp fallback URL generation

Create a single reliable WhatsApp phone normalizer used by both User and Guardian refill flows:

```text
+91 98765 43210  -> 919876543210
9876543210       -> 919876543210
09876543210      -> 919876543210
00919876543210   -> 919876543210
```

Then build the fallback URL with the normalized number:

```text
https://api.whatsapp.com/send?phone=919876543210&text=...
```

This should prevent the 404 page shown in the screenshot.

---

### 2. Make the fallback popup more reliable

In both refill components:

- Validate and normalize the pharmacy number before sending.
- Open the popup synchronously on button tap.
- Put a small “Preparing WhatsApp…” page in the popup while MSG91 is attempted.
- If MSG91 fails, navigate that same popup to the corrected WhatsApp URL.
- If MSG91 succeeds, close the popup.

This keeps the popup-blocker fix while also avoiding invalid WhatsApp URLs.

---

### 3. Deploy and harden the MSG91 pharmacy backend function

Update `send-pharmacy-order` to:

- Parse MSG91 response as text first, then JSON if possible.
- Log HTTP status and full MSG91 response.
- Treat MSG91 as successful only when the response indicates success, not just because HTTP status is `200`.
- Return a clean `{ success: false, error, result }` when MSG91 rejects the template, phone, or payload.
- Re-deploy the function so calls produce logs.

This will make it clear whether failures are from:
- missing/incorrect `MSG91_PHARMACY_TEMPLATE_ID`
- invalid MSG91 template variable mapping
- phone number rejection
- auth/session issue
- function deployment issue

---

### 4. Remove selected medicines from selectable lists immediately

When a User or Guardian taps **Order** from Low Stock Alerts or Order Medications:

- That medicine will move into **Your Order**.
- It will disappear from the selectable Low Stock list.
- It will disappear from the selectable Order Medications list.
- If the user removes it from the cart, it reappears.
- After sending, it remains in the **Order sent — pending receipt** card until received/dismissed.

This applies to both:
- `src/components/medications/RefillOrder.tsx`
- `src/components/WardRefillOrder.tsx`

---

### 5. Improve post-send confirmation wording

Because a browser `wa.me` / WhatsApp composer link cannot technically confirm delivery, the UI should avoid a false “delivered” claim.

The confirmation card will show one of these:

- **Order sent to pharmacy via MSG91 WhatsApp**
  - When MSG91 accepts the message
  - Show provider request ID if MSG91 returns one

- **WhatsApp opened — please tap Send**
  - When fallback opens the WhatsApp composer
  - This makes it clear the final send is done inside WhatsApp

The persistent pending card will keep:

- pharmacy number
- send method
- items ordered
- **Send again**
- **Received — Update Stock**

---

## Files to update

- `src/components/medications/RefillOrder.tsx`
- `src/components/WardRefillOrder.tsx`
- `supabase/functions/send-pharmacy-order/index.ts`

Optionally add a tiny shared utility file if cleaner:

- `src/lib/whatsapp.ts`

No database changes are required for this fix.

