-- Dynamically find and drop the check constraint on check_ins.status, then recreate it including 'late'
DO $$
DECLARE
    _constraint_name text;
BEGIN
    SELECT conname INTO _constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.check_ins'::regclass
      AND contype = 'c'
      AND array_to_string(conkey, ',') = (
          SELECT attnum::text
          FROM pg_attribute
          WHERE attrelid = 'public.check_ins'::regclass
            AND attname = 'status'
      );

    IF _constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.check_ins DROP CONSTRAINT ' || quote_ident(_constraint_name);
    END IF;

    ALTER TABLE public.check_ins
      ADD CONSTRAINT check_ins_status_check
      CHECK (status IN ('pending', 'responded', 'missed', 'escalated', 'late'));
END $$;
