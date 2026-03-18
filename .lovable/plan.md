## Activity Tracker for My Health

### Overview

Create an `ActivityTracker` component that lets users manually log daily activities (steps, exercises, sleep) and visualize their metrics over the past 7 days using Recharts bar/line charts. Renders when the "Activity" tile is selected in MyHealth.

### Database

**New table: `activity_logs**`

- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `log_date` (date, default CURRENT_DATE)
- `steps` (integer, default 0)
- `exercise_minutes` (integer, default 0)
- `exercise_type` (text, nullable) -- e.g. "Walking", "Yoga", "Cycling"
- `sleep_hours` (numeric, default 0)
- `notes` (text, nullable)
- `created_at` (timestamptz, default now())
- Unique constraint on `(user_id, log_date)` to enforce one entry per day
- RLS: authenticated users CRUD own rows only

### New Component: `src/components/ActivityTracker.tsx`

**Sections:**

1. **Today's Log Form** -- Input fields for steps, exercise (type + minutes), water intake, sleep hours, optional notes. Uses upsert so users can update today's entry. Save button with toast feedback.
2. **Today's Summary Cards** -- 2x2 grid showing today's stats with icons:
  - Steps (Footprints icon)
  - Exercise (Dumbbell icon)
  - Water (Droplets icon)  
  - Sleep (Moon icon)
3. **7-Day Chart** -- Recharts `BarChart` showing steps and exercise minutes over the last 7 days. Uses the existing `ChartContainer`/`ChartTooltip` from `src/components/ui/chart.tsx`.

**Pattern:** Follows CareJournal's structure -- uses `useAuth()` for user ID, Supabase queries, toast notifications, loading states.

### Integration

Update `src/pages/MyHealth.tsx`:

- Import `ActivityTracker`
- Add `{selectedTool === "Activity" && <ActivityTracker />}` alongside existing tool renders

### Files Changed

1. **Migration** -- Create `activity_logs` table with RLS
2. `**src/components/ActivityTracker.tsx**` -- New component (form + summary + chart)
3. `**src/pages/MyHealth.tsx**` -- Import and render ActivityTracker