

## Plan — Fix Pharmacy WhatsApp Send + UX

### Three problems found

1. **MSG91 send not happening, fallback not opening either** — likely caused by the popup-blocker rule: `wa.me` is opened from inside an `await`-resolved callback, so the browser treats it as a non-user-gesture and silently blocks it. Also, **no edge-function logs exist** for `send-pharmacy-order` — meaning either it never deployed, or invoke is failing silently before reaching the function. Both `RefillOrder` and `WardRefillOrder` have the same bug.
2. **Ordered medication stays visible in selection list** — after a successful WhatsApp send, the order panel still shows the medications as "in order" instead of clearing them out.
3. **No clear delivery confirmation** — the success toast is brief and doesn't visually distinguish MSG91 success vs `wa.me` fallback vs failure.

### Fix 1 — Send + fallback reliability

In **both** `src/components/medications/RefillOrder.tsx` and `src/components/WardRefillOrder.tsx`:

- Open the `wa.me` window **synchronously upfront** (`window.open("", "_blank")`) before any `await`, then either navigate it to `wa.me/...` (fallback path) or close it (MSG91 success path). This is the standard fix for popup blockers in async flows.
- On MSG91 invoke error, log the actual error object (currently only `console.warn` — add full stringification so we can see what's failing).
- Also defensively normalize the phone in the client (strip `+`, spaces, dashes) before sending — matches what the function expects.

### Fix 2 — Clear ordered meds after successful send

After **either** MSG91 success **or** `wa.me` fallback opens:
- Call `setOrderItems([])` to empty the cart.
- Reset `setOrderConfirmed(false)` so the confirmation panel collapses.
- Keep the medications in `allMeds` (they aren't deleted from the DB) but they'll no longer appear as "in order" — the **Order** button reappears beside each med, and low-stock items still show in the alerts list with a fresh **Order** button.
- The "Mark as Received" workflow moves to a separate persistent state (`pendingReceipt`) so the user can still update stock after the order panel resets — show a single small "Order sent — pending receipt" card with the items and the "✓ Received — Update Stock" button.

### Fix 3 — Clear delivery confirmation

Replace the brief toast with a **dedicated confirmation card** that appears for ~5 seconds after sending, showing:
- ✓ Green check + heading: **"Order sent to pharmacy"**
- Sub-line: **"via WhatsApp (MSG91)"** on success, or **"via WhatsApp (browser link)"** on fallback.
- Pharmacy number it was sent to.
- Items count.
- A "Send again" button in case the pharmacy didn't receive it.

Toast remains as a backup quick confirmation.

### Files modified

- `src/components/medications/RefillOrder.tsx` — User app
- `src/components/WardRefillOrder.tsx` — Guardian app

No edge-function or DB changes needed. The existing `send-pharmacy-order` function and `MSG91_PHARMACY_TEMPLATE_ID` secret stay as-is. If MSG91 still returns errors after the popup-blocker fix, the next step is to inspect the actual MSG91 response in the logs (now reachable because the function will be hit) and verify the template ID format with MSG91 — but that's a follow-up only if needed.

### Why the popup-blocker is the most likely root cause

`window.open()` called after `await supabase.functions.invoke(...)` runs outside the original click event context. Chrome, Safari, and Firefox all silently block this — no error, no popup, no toast progression. The user sees: button click → nothing happens → no WhatsApp opens → no fallback opens. This matches the symptom exactly.

