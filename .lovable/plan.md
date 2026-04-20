

## Plan

Pre-fill sensible defaults in `AddAppointmentDialog` so users only edit when needed.

### Changes to `src/components/appointments/AddAppointmentDialog.tsx`

**1. Default `start_date` and `end_date` to today (IST)**
- Update the `empty` form constant: replace `start_date: ""` and `end_date: ""` with today's date in `yyyy-MM-dd` format using the existing `getISTDateString()` helper from `@/lib/istTime`.
- Applies only when adding a new appointment (edit mode still loads saved values via existing `useEffect`).

**2. Auto-set `end_time` to start_time + 1 hour**
- Add an `onChange` handler for the Start Time input that:
  - Sets `start_time` to the chosen value
  - If `end_time` is empty OR was the previously auto-computed value, set `end_time = start_time + 1h` (wraps via 24h math; if it crosses midnight, also bump `end_date` to next day)
- User can still manually override `end_time` afterwards — once they edit it manually, we won't overwrite again (track via a small `endTimeManuallyEdited` ref/state flag).

**3. Reset behavior**
- When the dialog reopens for a new appointment, `empty` regenerates today's date fresh (move `empty` from a module constant into a function `makeEmpty()` so the date is always current, not stale from initial module load).

### Edge cases handled
- **Midnight crossover**: If start_time is 23:30, end_time becomes 00:30 and end_date advances by one day.
- **Edit mode**: Untouched — existing appointments load their saved dates/times.
- **User manual edit of end_time**: Respected; auto-fill stops once user types in End Time.

### Files to edit
- `src/components/appointments/AddAppointmentDialog.tsx` — single file change

### Out of scope
- Changing the default 1-hour duration to a user preference (could be a Settings option later)
- Validating end > start (no validation exists today; keeping consistent)

