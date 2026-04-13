

## Payment Success Confirmation Screen

### What changes

**`src/pages/Subscription.tsx`** — Instead of only showing a toast on `?status=success`, display a full-screen confirmation card that overlays the plan cards. The card will include:

- A checkmark animation/icon
- "Payment Successful!" heading
- Plan name and billing cycle (read from URL params or subscription query)
- Expiry date (from refreshed subscription data)
- Amount paid
- "Next Steps" list: set up guardians, configure medications, explore health tools
- "Go to Dashboard" and "Explore Features" buttons
- A dismiss/close option that clears the status param and shows the normal page

### Implementation details

1. Add new state `showSuccess` (boolean), set to `true` when `status=success` is detected
2. Add URL params `plan` and `billing` to the redirect URL in `handleChoosePlan` so they're available on return
3. When `showSuccess` is true, render a confirmation `Card` above/instead of the plan cards with:
   - Green checkmark icon (CheckCircle2 from lucide)
   - Plan details from URL params or the refreshed `subscription` object
   - Next steps as a simple list with navigation links
   - "Go to Dashboard" button linking to `/dashboard`
4. Keep the toast as a secondary notification
5. Dismissing the card sets `showSuccess = false` and clears search params

### Files modified

| File | Change |
|------|--------|
| `src/pages/Subscription.tsx` | Add success confirmation card UI, update redirect URL to include plan/billing params |

