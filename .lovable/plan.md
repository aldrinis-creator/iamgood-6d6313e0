

# Fix Medication Reminder Flow

## Current Behavior vs Target

| Aspect | Current | Target |
|--------|---------|--------|
| Audio | Fires once with overlay | Same (correct) |
| Snooze | Unlimited, overlay-only (no audio) | Max 3 snoozes, overlay-only after first |
| Missed detection | Visual-only in TodaySchedule UI | Auto-write `medication_logs` record with `status: "missed"` after 1 hour |
| Guardian notification on miss | None | Send notification to guardians when dose is auto-marked missed |

## Changes

### 1. ReminderOverlay — add snooze counter and max limit
**File:** `src/components/ReminderOverlay.tsx`

- Add a `snoozeCountRef` (Map keyed by reminder title+message) to track how many times each reminder has been snoozed.
- On snooze: increment counter. If counter reaches 3, show a toast "Maximum snoozes reached" and dismiss without re-scheduling.
- Display remaining snoozes in the snooze button label: "Snooze 5 min (2 left)".
- After 3 snoozes are exhausted, hide the snooze button entirely.

### 2. useMedicationAlarms — add missed-dose auto-logging
**File:** `src/hooks/useMedicationAlarms.ts`

- In the `check()` callback, after processing current-time alarms, add a second pass that finds medication slots from the past hour (scheduled time is 60+ minutes ago).
- For each such slot, check if a `medication_logs` record already exists for that `medication_id` + `scheduled_at`. If not:
  - Insert a `medication_logs` record with `status: "missed"`, `scheduled_at` set to the computed time, no `taken_at`.
  - Send guardian notifications via the existing `notify-guardian-medication` edge function with `status: "missed"`.
- Use a separate `missedFiredRef` to avoid re-processing the same slot every 30 seconds.

### 3. TodaySchedule — no changes needed
The UI already reads from `medication_logs` and shows missed status. Once the hook writes the record, it will appear automatically.

## Technical Details

- The snooze counter uses a `useRef<Map<string, number>>` keyed by a composite of reminder type + title to persist across re-renders without causing re-render cycles.
- The missed-dose check queries `medication_logs` for existing records before inserting, preventing duplicates.
- Guardian notifications reuse the existing `notify-guardian-medication` edge function.

## Files Changed
- `src/components/ReminderOverlay.tsx` — snooze limit (max 3), counter display
- `src/hooks/useMedicationAlarms.ts` — auto-write missed logs after 1 hour, notify guardians

