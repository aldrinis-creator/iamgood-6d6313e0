## Why it doesn't highlight today

The My Health tab's red badge in `src/components/NavTabs.tsx` (line 73) is driven only by `useRefillDue`, which flags **low stock** (`remaining_quantity <= low_stock_threshold`). It has no awareness of whether a scheduled dose is due-but-untaken. So an overdue medication never turns the tab red.

## Fix

Add a second signal — "any dose due today and not yet logged as taken" — and OR it into the My Health badge.

### 1. New hook `src/hooks/useMedicationDue.ts`

- Query `medications` (id, schedule_times, start_date, end_date) active for today (IST).
- Query today's `medication_logs` (medication_id, scheduled_at, status) for the user.
- Build the day's dose slots; a slot is "due now" if scheduled time is `<= now IST` AND no matching log with status `taken` / `taken_late` / `skipped` exists.
- Return `true` if any slot is due-now-and-not-taken. Re-check every 60s and via Realtime on `medications` + `medication_logs` (unique channel name per mount, per Core rule).

### 2. `src/components/NavTabs.tsx`

- Import and call the new hook: `const medDue = useMedicationDue();`.
- Change the My Health tab badge to `badge: (refillDue || medDue) ? 1 : 0`.
- Keep the existing "!" glyph and red pulsing style already wired for `My Health`.

### 3. No other changes

- Dashboard scoring, alarms, and voice assistant remain untouched (they already reflect pending doses correctly per the earlier fix).
- Guardian nav unaffected.

## Verification

- With a scheduled dose in the past and no log → My Health icon + "!" badge turn red and pulse.
- After marking the dose taken → badge clears within ~1s (Realtime) or on next 60s poll.
- Low-stock-only case still turns the tab red (existing behavior preserved).
- No console errors from duplicate Realtime channels.
