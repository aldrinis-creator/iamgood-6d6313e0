## Problem

When a user picks "Date Range" in Check-Out (e.g. 10 days), the dialog correctly saves `checkOutConfig` (with `endsAt` = end-of-day on the last selected date) to `user_settings` in the DB. However, after a reload (or even a re-render when settings finish loading), the dashboard shows **Active** mode again, so daily check-in reminders resume.

## Root cause

`pauseMode` lives in `AppContext` as plain React state, initialised to `"active"`:

```ts
// src/contexts/AppContext.tsx:104
const [pauseMode, setPauseMode] = useState<PauseMode>("active");
```

It is **never hydrated from `settings.pauseMode`** (which IS persisted via `useUserSettings`). So although `updateSetting("pauseMode", "checked-out")` writes to the DB, the in-memory `pauseMode` resets to `"active"` on every fresh app load. The auto-return effect then runs and, finding nothing to do for `"active"`, leaves it active.

The same issue silently affects the Sleep mode persistence on reload, but is masked by `useAutoSleepMode` re-asserting it from the schedule.

## Fix

Hydrate `pauseMode` from persisted settings, and on hydration honour an unexpired `checkOutConfig.endsAt`.

### 1. `src/contexts/AppContext.tsx`
- Import `useUserSettings` (already used elsewhere — safe inside `AppProvider`, which is nested under `AuthProvider` and `QueryClientProvider`).
- Add an effect that, once `settings` are loaded, syncs `pauseMode` from `settings.pauseMode` exactly once per session:
  - If `settings.pauseMode === "checked-out"` and `settings.checkOutConfig?.endsAt` is in the future → `setPauseMode("checked-out")`.
  - If `settings.pauseMode === "checked-out"` but `endsAt` is past/missing → leave at `"active"` (auto-return semantics).
  - If `settings.pauseMode === "sleep"` → leave it for `useAutoSleepMode` to re-assert (don't fight it).
- Track a `hydratedRef` so subsequent local changes via `setPauseMode` are not overridden.

### 2. `src/pages/UserDashboard.tsx`
- The existing on-mount auto-return effect already handles expired `endsAt`. No change needed there.
- Confirm `handleCheckOutSave` continues to call `updateSetting("pauseMode", "checked-out")` (already does).

### 3. No DB / migration changes
`user_settings.settings.pauseMode` is already stored as JSON; nothing to migrate.

## Out of scope
- Dialog UX (the date-range picker itself works correctly).
- Guardian notifications (already fire on save).
- Sleep-mode persistence rework (auto-sleep handles it).

## Verification
1. Set Check-Out → Date Range → today + 10 days → Save.
2. Hard reload the app.
3. Dashboard should still show **Checked Out** with the "Returns at …" line, and check-in reminders should remain paused for the full window.
4. After `endsAt` passes, the auto-return effect flips back to **Active** and shows the resume toast.
