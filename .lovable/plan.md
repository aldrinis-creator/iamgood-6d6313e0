

## Fix: Guardian Dashboard Showing Wrong Ward's Notifications

### Root Cause

The `fetchNotifications` function in `GuardianDashboard.tsx` (line 229) queries the `notifications` table with no ward filter — it fetches all notifications visible to the logged-in user via RLS. Since Don Carlos is both a user (who missed check-ins) and a guardian (of Aldrin), the dashboard shows Don Carlos's own missed check-in alerts when viewing Aldrin's dashboard.

The notifications table has both `user_id` (the ward whose event triggered it) and `guardian_id` columns. The fix is to filter by the selected ward's `user_id`.

### Changes

**File: `src/pages/GuardianDashboard.tsx`**

Update `fetchNotifications` to filter by the selected ward's user_id:

```typescript
// Current (broken) — no ward filter
const { data } = await supabase
  .from("notifications")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(10);

// Fixed — filter to only show notifications for the selected ward
const { data } = await supabase
  .from("notifications")
  .select("*")
  .eq("user_id", selectedWard.userId)   // only this ward's notifications
  .order("created_at", { ascending: false })
  .limit(10);
```

Also add `selectedWard` to the `useCallback` dependency array and add an early return if no ward is selected.

### Impact

- Guardian Dashboard will only show notifications relevant to the currently selected ward
- Switching wards via the WardPicker will correctly refresh notifications
- No database or edge function changes needed

