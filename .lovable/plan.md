

## Plan

When the user changes the **Start Date**, auto-sync the **End Date** to match — same pattern as the existing Start Time → End Time auto-sync.

### Change to `src/components/appointments/AddAppointmentDialog.tsx`

**1. Track manual end-date edits**
- Add a new ref: `endDateManuallyEdited = useRef(false)` (mirrors existing `endTimeManuallyEdited` pattern).
- Reset to `false` when dialog opens for a new appointment; set to `true` when loading an existing appointment for edit.

**2. Auto-sync End Date on Start Date change**
- Replace the current `Start Date` input's simple `onChange={(e) => set("start_date", e.target.value)}` with a handler that:
  - Sets `start_date` to the new value
  - If `endDateManuallyEdited.current === false`, also sets `end_date = newStartDate`
- User can still edit End Date independently — once they do, set `endDateManuallyEdited.current = true` and stop auto-syncing.

**3. Mark End Date as manually edited on user input**
- Add `onChange` to the End Date input that flips `endDateManuallyEdited.current = true` before calling `set("end_date", …)`.

### Edge case interaction with existing Start Time → End Time logic
- The existing `addOneHour` helper already handles midnight crossover by bumping `end_date`. Order of operations: if user picks Start Date first then Start Time, both auto-sync correctly (End Date follows Start Date; if Start Time crosses midnight, End Date advances one more day — still correct).
- If user picks Start Time first (which already sets end_date via midnight logic) and then changes Start Date, the new Start Date wins for End Date (still respects "user hasn't manually edited end date").

### Files to edit
- `src/components/appointments/AddAppointmentDialog.tsx` — single file change

### Out of scope
- Validating End Date ≥ Start Date (no validation exists today; staying consistent)
- Multi-day duration preference

