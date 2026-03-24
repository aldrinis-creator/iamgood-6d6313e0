

# Replace Take/Skip Buttons with Checkbox for Medication Doses

## What Changes

Replace the current two-button (Check + X) UI with a single **checkbox** per dose. The checkbox is:
- **Unchecked** and **enabled** while within the ±60 minute time window
- **Checked** when the user ticks it (marks as taken)
- **Disabled** (greyed out, inaccessible) once the time window expires
- **Checked + disabled** if already taken

The Skip button is removed — if the user doesn't check the box within the window, it auto-becomes missed (existing logic handles this).

## File Changed

**`src/components/medications/TodaySchedule.tsx`**

- Import `Checkbox` from `@/components/ui/checkbox`
- Remove the `markSkipped` function (no longer needed in UI)
- Replace the button group (lines 275-283) with a single `<Checkbox>`:
  - `checked={slot.status === "taken"}`
  - `disabled={slot.status !== "pending" || !isCurrent}` — disabled if already taken/missed/skipped OR outside the ±60 min window
  - `onCheckedChange={() => markTaken(slot)}` — checking it marks the dose as taken
- For taken doses: show a checked, disabled checkbox with green styling
- For missed/past doses: show an unchecked, disabled checkbox (greyed out)
- For pending + current window: show an unchecked, enabled checkbox
- Remove the `X` import from lucide (no longer used for skip button)
- Keep the AlertTriangle icon for missed doses as additional visual cue

