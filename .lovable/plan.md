

## Create LAUNCH50 Coupon

Insert the LAUNCH50 coupon into the `coupons` table with the specified parameters.

```sql
INSERT INTO public.coupons (
  code,
  discount_type,
  discount_value,
  applicable_plans,
  expires_at,
  max_uses,
  is_active
) VALUES (
  'LAUNCH50',
  'percentage',
  50,
  '{basic,pro}',
  '2026-12-31T23:59:59+05:30',
  200,
  true
);
```

