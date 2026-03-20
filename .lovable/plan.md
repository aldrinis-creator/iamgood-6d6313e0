

# Fix Activity Tracker Data Logging

## Problem
The Activity Tracker's "Save Today's Log" button likely fails silently due to the `onConflict` parameter format in the upsert call. The composite unique constraint on `(user_id, log_date)` may not be matching correctly.

## Root Cause Investigation
After reviewing the code, two potential issues:

1. **Upsert `onConflict` format** — Supabase JS client sometimes needs the constraint name rather than column names for composite keys. The current code uses `{ onConflict: "user_id,log_date" }` which may not resolve correctly.

2. **No error visibility** — If the upsert fails but doesn't throw (returns error in response), the toast shows the error, but if the user misses it, data silently doesn't persist.

## Changes

### 1. `src/components/ActivityTracker.tsx`
- Add `console.error` logging alongside the toast for debugging
- Add an explicit check: try insert first, if conflict then update (two-step approach as fallback)
- Alternatively, switch to a select-then-upsert pattern: check if today's entry exists, then use `insert` or `update` accordingly
- Add a `console.log` before the upsert call to confirm `handleSave` is actually invoked with the correct payload

### 2. Verification approach
- After the fix, the save flow will: check for existing row → insert or update → refresh data → update UI

## Specific code fix
Replace the single `upsert` with:
```typescript
// Check if today's entry exists
const { data: existing } = await supabase
  .from("activity_logs")
  .select("id")
  .eq("user_id", user.id)
  .eq("log_date", today)
  .maybeSingle();

const payload = { user_id: user.id, log_date: today, ...formFields };

if (existing) {
  // Update existing
  const { error } = await supabase
    .from("activity_logs")
    .update(formFields)
    .eq("id", existing.id);
} else {
  // Insert new
  const { error } = await supabase
    .from("activity_logs")
    .insert(payload);
}
```

This avoids the `onConflict` issue entirely and is more reliable with composite unique constraints.

No database changes needed.

