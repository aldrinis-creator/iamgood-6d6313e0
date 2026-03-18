-- Add created_by column for guardian who wrote the entry
ALTER TABLE public.care_journal ADD COLUMN created_by uuid;

-- Drop old user-only RLS policies
DROP POLICY IF EXISTS "Users can delete own journal entries" ON public.care_journal;
DROP POLICY IF EXISTS "Users can insert own journal entries" ON public.care_journal;
DROP POLICY IF EXISTS "Users can select own journal entries" ON public.care_journal;
DROP POLICY IF EXISTS "Users can update own journal entries" ON public.care_journal;

-- Guardian can insert journal entries for their ward
CREATE POLICY "Guardians can insert ward journal entries"
ON public.care_journal FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
    AND g.user_id = care_journal.user_id
  )
);

-- Guardian can select journal entries they created
CREATE POLICY "Guardians can select ward journal entries"
ON public.care_journal FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid())
    AND g.user_id = care_journal.user_id
  )
);

-- Guardian can update journal entries they created
CREATE POLICY "Guardians can update ward journal entries"
ON public.care_journal FOR UPDATE TO authenticated
USING (created_by = auth.uid());

-- Guardian can delete journal entries they created
CREATE POLICY "Guardians can delete ward journal entries"
ON public.care_journal FOR DELETE TO authenticated
USING (created_by = auth.uid());