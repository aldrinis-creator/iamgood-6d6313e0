## Goal

Two changes to the **Tablets** tab medication flows:

1. When a medication's **End Date** has passed, prompt the user to **Continue** or **Delete** it (instead of silently hiding it). If Delete is chosen, the medication is permanently removed and never appears in any sub-tab.
2. Fix the bug where medications past their end date still show up in **Refill** and **Today's Schedule** (and in the low-stock badge counter). Today only `MedicationList` filters on `end_date`; the other surfaces don't.

## Investigation findings

End-date filtering today:

| Surface | File | Filters on `end_date`? |
|---|---|---|
| Meds list | `MedicationList.tsx` | Yes (`.or("end_date.is.null,end_date.gt.<today>")`) |
| Today's Schedule | `TodaySchedule.tsx` | **No** |
| Refill | `RefillOrder.tsx` (`load()`) | **No** |
| Low-stock badge dot | `MedicationManager.tsx` (`checkLowStock`) | **No** |

That's why an expired med keeps appearing in Refill and elsewhere with no way to remove it.

## Plan

### 1. "Ended medications" prompt in the Meds sub-tab

In `MedicationList.tsx`:

- Change the load query to fetch **all** of the user's meds (drop the `end_date` `.or` filter) and split them in memory into:
  - `activeMeds`: `end_date` is null OR `end_date >= today` (IST via `getISTDateString()`)
  - `endedMeds`: `end_date < today`
- Render `activeMeds` in the existing list exactly as today.
- If `endedMeds.length > 0`, render a new **"Ended medications"** section above the active list (amber/muted card) listing each ended med with name, dosage, and end date, plus two buttons per row:
  - **Continue** — opens an `AlertDialog` ("Continue this medication?") with a date input prefilled to today + 30 days. On confirm, `UPDATE medications SET end_date = <new date>` (or set to null if user picks "No end date"). Reload.
  - **Delete** — opens the existing destructive `AlertDialog` pattern; on confirm, `DELETE FROM medications WHERE id = ...`. Reload.
- Both actions call `onRefillDone`-equivalent / re-trigger parent low-stock check (lift via a small `onChange` callback prop, or just rely on the existing `MedicationManager.checkLowStock` re-firing on tab switch — simplest: add an `onChange` prop and call it after Continue/Delete).

### 2. Apply the end-date filter everywhere meds are read

Add the same "active only" predicate to the three other reads, so an expired med never leaks into Refill, Today's Schedule, or the low-stock dot:

- `MedicationManager.tsx` `checkLowStock`: also select `end_date` and filter in JS (`!end_date || end_date >= today`) before computing `hasLowStock`.
- `RefillOrder.tsx` `load()`: select `end_date`, append `.or("end_date.is.null,end_date.gte.<today>")` so expired meds disappear from both the low-stock list and the "all meds" picker.
- `TodaySchedule.tsx` `loadSchedule()`: same `.or` filter alongside the existing `start_date` filter, so expired meds drop out of today's schedule.

Use IST today via the existing `getISTDateString()` helper for consistency with `MedicationList`.

### Out of scope

- No DB migration (uses existing `end_date` column).
- No changes to `medication_logs` history (past adherence records remain).
- No guardian-side changes.
- No change to alarms code beyond what falls out of `TodaySchedule` filtering (alarms hook uses its own query, not touched here unless you want; flag if you do).

## Files to edit

- `src/components/medications/MedicationList.tsx` — split active/ended, add Continue/Delete prompts, add `onChange` callback prop.
- `src/components/medications/MedicationManager.tsx` — pass `onChange={checkLowStock}` to `MedicationList`; filter `end_date` in `checkLowStock`.
- `src/components/medications/RefillOrder.tsx` — add `end_date` filter in `load()`.
- `src/components/medications/TodaySchedule.tsx` — add `end_date` filter in `loadSchedule()`.

No new files, no schema changes.