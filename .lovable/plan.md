# Fix: Financial Healthcare total not updating after adding bills

## Diagnosis

The screen shows totals filtered to the selected period (Week / Month / Year in IST). The most recent scanned bill was saved with `expense_date = 2024-07-05` — the AI mis-read the year from the bill. Because it's ~2 years in the past, it's excluded from every period view even though it's in the database.

Manual entries with correct 2026 dates do show up. So the load/refresh/RLS/trigger paths are fine — the issue is the AI-extracted date silently landing in the past.

## Fix

1. **Sanity-check AI-extracted dates in `ScanPane.handleFile`** (`src/pages/FinancialHealth.tsx`):
   - Keep the AI date only if it's within a plausible window: not more than ~90 days in the future and not older than ~2 months ago.
   - Otherwise fall back to `todayIso()` so the entry lands in the current period.

2. **Visual warning in `ScanReviewForm`**: if the prefilled date is not today's IST date, show a small amber note beside the Date field ("AI read this date from the bill — please confirm") so the user notices before saving.

3. **Backfill the affected row** so the existing total reflects it:
   - Update the one bill_scan row from `2024-07-05` to `2026-07-05` (same month/day, correct year — most likely what the bill actually said, since it was scanned on 2026-07-12).

No changes to schema, RLS, triggers, or the load logic — the data flow is already correct.

## Files touched

- `src/pages/FinancialHealth.tsx` — date sanity check + inline warning
- One data update on `healthcare_expenses` to correct the stale year on the existing row
