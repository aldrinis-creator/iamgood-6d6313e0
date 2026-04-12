

## Coupon Code Discount System

### 1. Database: Create `coupons` table

```sql
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  applicable_plans text[] NOT NULL DEFAULT '{basic,pro}',
  max_uses integer DEFAULT NULL,        -- NULL = unlimited
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone DEFAULT NULL,  -- NULL = no expiry
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Only service role can manage coupons
CREATE POLICY "Service role manages coupons" ON public.coupons
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read active coupons (for validation)
CREATE POLICY "Users can read active coupons" ON public.coupons
  FOR SELECT TO authenticated
  USING (is_active = true);
```

Add `coupon_code` column to `subscriptions` table:
```sql
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS coupon_code text DEFAULT NULL;
```

### 2. Edge Function: `validate-coupon`

New edge function that accepts `{ code, plan_type }` and returns:
- `{ valid: true, discount_type, discount_value, discounted_price }` on success
- `{ valid: false, reason: "..." }` on failure

Validates: code exists, is_active, not expired, not over max_uses, applicable to plan.

### 3. Frontend: Subscription Page Changes

**Add to `src/pages/Subscription.tsx`:**
- A "Have a promo code?" collapsible input below the billing toggle
- Text input + "Apply" button
- On apply: call `validate-coupon` edge function
- Show success badge with discount amount or error message
- Pass `coupon` param in the payment redirect URL
- Show discounted price on plan cards when coupon is applied

**UI flow:**
1. User taps "Have a promo code?" — input expands
2. Enters code, taps Apply
3. Edge function validates → show "20% off applied!" or error
4. Plan card prices update to show original price struck through + discounted price
5. On "Go Pro" / "Choose Basic" → redirect includes `&coupon=CODE`

### 4. Confirm-Payment Webhook Update

Update `supabase/functions/confirm-payment/index.ts`:
- Accept optional `coupon_code` in the webhook body
- Store `coupon_code` in the subscription record
- Increment `used_count` on the coupons table

### Files to create/modify

| File | Action |
|------|--------|
| Migration SQL | Create `coupons` table + alter `subscriptions` |
| `supabase/functions/validate-coupon/index.ts` | New edge function |
| `src/pages/Subscription.tsx` | Add promo code input, discount display, pass coupon in redirect |
| `supabase/functions/confirm-payment/index.ts` | Store coupon_code, increment used_count |

### Technical Details

- Discount calculation is done server-side in validate-coupon to prevent tampering
- The actual charge amount is controlled by futurewave.in payment page — the coupon code is passed as a URL param for their system to apply
- The confirm-payment webhook records which coupon was used for analytics
- Coupons are managed via direct DB inserts (service role) — no admin UI needed initially

