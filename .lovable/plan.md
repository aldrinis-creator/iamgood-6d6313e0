## Problem
`purge_dlq()` runs `DELETE FROM pgmq.q_<name>` with no WHERE clause. Postgres (with `sql_safe_updates` on, which Supabase enables by default for some roles) rejects this with "No where clause for Delete".

## Fix
Update the `purge_dlq` database function to use pgmq's built-in purge helper instead of a raw unqualified DELETE:

```sql
CREATE OR REPLACE FUNCTION public.purge_dlq(dlq_name text)
RETURNS bigint ...
AS $$
DECLARE deleted_count bigint;
BEGIN
  -- auth checks unchanged
  SELECT pgmq.purge_queue(dlq_name) INTO deleted_count;
  RETURN deleted_count;
EXCEPTION WHEN undefined_function THEN
  -- fallback for older pgmq: use TRUNCATE (no WHERE needed, bypasses safe_updates)
  EXECUTE format('TRUNCATE pgmq.q_%I', dlq_name);
  RETURN 0;
END;
$$;
```

`pgmq.purge_queue` returns the number of deleted rows and is the supported API. `TRUNCATE` is the safe fallback. Neither triggers the no-WHERE error.

No frontend changes needed — UI already calls this RPC.

## Steps
1. Migration to replace `public.purge_dlq` with the version above.
2. Test by clicking "Purge all" on the DLQ tab; expect the row count to clear and the toast to show success.
