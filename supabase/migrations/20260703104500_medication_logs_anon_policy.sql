-- Anon SELECT on medication_logs for users with active share tokens
CREATE POLICY "Anon can read medication_logs with active share token" ON public.medication_logs
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.emergency_share_tokens est
    WHERE est.user_id = medication_logs.user_id AND est.is_active = true
  ));
