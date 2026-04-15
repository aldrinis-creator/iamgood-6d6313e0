

## Branded Payment Receipt

### Overview
Add a "Download Receipt" button to the payment success screen that generates a Check-iN branded PDF receipt using the existing letterhead system (`buildLetterheadHtml`). The receipt will include transaction details pulled from the `subscriptions` table.

### Changes

**1. New utility: `src/lib/receiptPdf.ts`**
- Export `printReceipt(data)` function that builds a receipt using `buildLetterheadHtml` from `reportPdf.ts`
- Receipt content includes:
  - Receipt number (subscription ID, truncated)
  - Date of payment (IST formatted)
  - Plan name (Basic / Pro) and billing cycle
  - Amount paid (₹)
  - Coupon code applied (if any)
  - Validity period (starts_at → expires_at)
  - Payment reference (Razorpay payment ID, if available)
  - User name from profile
- Uses the existing letterhead CSS, header/footer images — no medical disclaimer
- Opens in a new window and triggers `window.print()` (same pattern as `printReport`)

**2. Update `src/pages/Subscription.tsx`**
- On the success card (lines 222-296), add a "Download Receipt" button after "Go to Dashboard"
- Fetch the active subscription record (already available via `useSubscription`) plus user profile name
- Pass subscription data to `printReceipt()`
- Button styled with `Printer` icon, secondary variant

**3. Update `src/hooks/useSubscription.ts`**
- Include `coupon_code`, `razorpay_payment_id`, `starts_at` in the returned subscription type so the receipt has all fields

### Files
| File | Action |
|------|--------|
| `src/lib/receiptPdf.ts` | New — receipt HTML builder using existing letterhead |
| `src/pages/Subscription.tsx` | Add "Download Receipt" button to success card |
| `src/hooks/useSubscription.ts` | Expand returned fields |

