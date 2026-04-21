-- Add missing columns to medication_orders for pending-receipt persistence
ALTER TABLE public.medication_orders
  ADD COLUMN IF NOT EXISTS pharmacy_phone text,
  ADD COLUMN IF NOT EXISTS send_method text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

-- Default new orders to 'pending_receipt' so the persistent card shows up
ALTER TABLE public.medication_orders
  ALTER COLUMN status SET DEFAULT 'pending_receipt';

-- Migrate any legacy 'ordered' rows to the new status name
UPDATE public.medication_orders
  SET status = 'pending_receipt'
  WHERE status = 'ordered';

-- Helpful index for quickly fetching open orders per ward
CREATE INDEX IF NOT EXISTS idx_medication_orders_user_status
  ON public.medication_orders (user_id, status);