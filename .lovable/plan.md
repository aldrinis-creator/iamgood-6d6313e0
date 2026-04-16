

## Update Premium Plus Pricing & Add Pre-Register Section

### What changes
1. **Premium Plus yearly price**: Update from ₹9,999 to ₹9,999 (keep) but add a strikethrough "MRP" of ₹14,999 (instead of the current ₹9,999 strikethrough). Monthly stays at ₹999.
2. **Pre-Register section**: Replace the "Get Smart Ring Bundle" button on the Premium Plus card with a "Pre-Register Now" section matching the screenshot — bold title, ₹9,999 price with ₹14,999 strikethrough, email input, and "Notify Me" button.
3. **Email link**: The "Notify Me" action sends a mailto to `checkin_support@futurewave.in` (or stores the email for notifications).

### Technical details

**`src/pages/Subscription.tsx`**

- Add an `mrp` field to the Premium Plus plan config: `mrp: 14999` (yearly), displayed as strikethrough above the actual price
- For the Premium Plus card specifically, replace the "Get Smart Ring Bundle" `<Button>` with a styled "Pre-Register Now" block:
  - Title: **Pre-Register Now**
  - Price display: ₹9,999 with ₹14,999 strikethrough
  - Email input + "Notify Me" button (teal/success colored)
  - On submit: opens `mailto:checkin_support@futurewave.in?subject=Pre-Register Premium Plus&body=...` with the entered email, or shows a toast confirmation
- Dark gradient background on the pre-register section matching the screenshot aesthetic

### Files
| File | Action |
|------|--------|
| `src/pages/Subscription.tsx` | Update Premium Plus pricing display; add Pre-Register section |

