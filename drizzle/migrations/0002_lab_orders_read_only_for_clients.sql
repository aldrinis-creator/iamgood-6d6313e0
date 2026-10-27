-- lab_orders: browsers may only READ.
-- Every write (booking, cancel/reschedule bookkeeping, webhook updates) is done by edge functions using the service
-- role, which bypasses RLS. The old "FOR ALL" policy let a signed-in user edit their own booking row from the browser
-- (status, report_url, ids). The guardian SELECT policy from the original migration is unchanged.
DROP POLICY IF EXISTS "Users can manage own lab orders" ON public.lab_orders;
DROP POLICY IF EXISTS "Users can view own lab orders" ON public.lab_orders;

CREATE POLICY "Users can view own lab orders"
  ON public.lab_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);