-- Backfill: replace 'pro' with 'premium' in existing coupon rows
UPDATE public.coupons
SET applicable_plans = (
  SELECT ARRAY(
    SELECT DISTINCT CASE WHEN p = 'pro' THEN 'premium' ELSE p END
    FROM unnest(applicable_plans) AS p
  )
)
WHERE 'pro' = ANY(applicable_plans);

-- Update default for new coupons
ALTER TABLE public.coupons
  ALTER COLUMN applicable_plans SET DEFAULT '{basic,premium}'::text[];