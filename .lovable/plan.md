

## Move Health Passport Score Ring to Top of Guardian Dashboard

### What Changes

1. **Create `WardHealthScoreRing` component** (`src/components/WardHealthScoreRing.tsx`)
   - A compact inline widget showing the ward's overall Health Passport score as a small ring (48x48px) with green/yellow/red coloring, placed next to the ward name/status area.
   - Fetches the latest score from `health_passport_scores` table for today (single query, lightweight).
   - Displays: ring + score number + short label ("Great" / "Steady" / "Needs Attention").
   - Refreshes every 60 seconds.

2. **Insert the ring in the User Status card** (`src/pages/GuardianDashboard.tsx`, ~line 640-680)
   - Place `<WardHealthScoreRing wardUserId={wardUserId} />` inside the existing User Status card, next to the ward name/mode indicator — keeping it compact as a single row element rather than a separate card.

3. **Remove `WardHealthPassport` from the bottom reference group** (`src/pages/GuardianDashboard.tsx`, ~line 884-886)
   - Delete the Health collapsible section that currently wraps `WardHealthPassport`.
   - The full category breakdown is still available on the Guardian Reports page.

### Files
- **New**: `src/components/WardHealthScoreRing.tsx`
- **Modify**: `src/pages/GuardianDashboard.tsx` — add ring to status card, remove Health collapsible section

