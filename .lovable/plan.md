

## Replace "Now" Tile with Real-Time "Last Active"

### Problem
The 3rd tile in the guardian status band shows the current clock time labeled "Now" — useless information. It should show when the ward last interacted with their phone.

### Changes

**1. Database Migration**
Add `last_active_at` column to `profiles`:
```sql
ALTER TABLE public.profiles ADD COLUMN last_active_at timestamptz;
```
No new RLS needed — guardians already have SELECT on ward profiles via existing guardian policies.

**2. New Hook: `src/hooks/useActivityHeartbeat.ts`**
- Listens to `pointerdown`, `scroll`, `keydown`, `visibilitychange` events
- Debounces writes to **2 minutes** to minimize DB load
- Updates `profiles.last_active_at = now()` for the current user
- Only active for `user` role accounts

**3. Wire into `src/components/AppLayout.tsx`**
Add `useActivityHeartbeat()` inside the existing `UserOnlyHooks` component.

**4. Update `src/pages/GuardianDashboard.tsx`**
- Fetch `last_active_at` from the ward's profile row alongside existing data
- Replace the "Now" tile (lines 761-765):
  - Icon: `Smartphone` instead of `Clock`
  - Value: relative time from `last_active_at` (e.g. "2 min ago", "1h ago")
  - Label: "Last Active"
- Subscribe to realtime changes on `profiles` filtered to ward user ID for live updates

### Files
| File | Action |
|------|--------|
| Migration SQL | Add `last_active_at` column |
| `src/hooks/useActivityHeartbeat.ts` | New — debounced activity tracker |
| `src/components/AppLayout.tsx` | Add heartbeat to `UserOnlyHooks` |
| `src/pages/GuardianDashboard.tsx` | Replace "Now" tile, fetch + subscribe to `last_active_at` |

