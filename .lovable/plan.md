

# Add "Last Updated" Timestamp to Battery on Guardian Dashboard

## Change

Show a relative timestamp (e.g. "2 min ago") next to the battery percentage in the Guardian Dashboard's info section. The timestamp comes from the ward's `user_settings.updated_at` field, which is already saved whenever battery level changes.

## Technical Plan

### `src/pages/GuardianDashboard.tsx`
- Already fetching ward settings — store `updated_at` from the `user_settings` row alongside `wardBattery`
- Add a new state variable `batteryUpdatedAt: string | null`
- Next to the battery percentage display, render a small muted text like "Updated 5 min ago" using `formatDistanceToNow` from `date-fns`
- If no timestamp available, show "—"

| File | Change |
|------|--------|
| `src/pages/GuardianDashboard.tsx` | Store `updated_at`, display relative timestamp next to battery % |

