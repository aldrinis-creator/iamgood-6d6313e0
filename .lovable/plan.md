

# Simplify Medication Taken Flow + Snooze + Fix "Not Taken" Bug

## Problems Identified

1. **Taken medications stay visible** — after checking the box, the card remains with a "TAKEN" badge. User wants it to disappear.
2. **Checkbox only works during ±1 hour window** — `disabled={slot.status !== "pending" || !isCurrent}` blocks interaction outside that window.
3. **No snooze option** — user can only take or miss, no deferral.
4. **"Not Taken" bug** — The `useMedicationAlarms.ts` hook writes a `missed` log at 60 minutes past. But `TodaySchedule.tsx` matches logs using `scheduledAt.toISOString()` as the key. If there's any timezone/millisecond mismatch between the two components constructing the `scheduledAt` Date, the log won't match and the UI shows "pending" which then falls through to "missed" visually. The alarm hook also inserts a `missed` log even if the user already marked it `taken` (it only checks for *existence* of a log, not its status — but the real issue is the key mismatch).

## Changes

### 1. Hide taken medications from the list (`TodaySchedule.tsx`)
- After `markTaken`, animate the card out (fade + shrink) and filter it from the visible list after 1.5 seconds.
- Keep taken doses in `doses` state for the progress bar count, but filter them from the rendered grouped list.
- Add a small "Show completed" toggle at the bottom so user can review what they took.

### 2. Add Snooze buttons (5min / 15min) (`TodaySchedule.tsx`)
- For each pending dose in the current window, show two snooze buttons: "5m" and "15m".
- Track snooze count per dose in local state (`Map<slotKey, number>`). Max 3 snoozes.
- When snoozed, hide the card temporarily and re-show it after the snooze duration.
- After 3 snoozes with no action, auto-insert a `missed` log (status = "missed") and notify guardians.

### 3. Fix the "Not Taken" status mismatch
- **Root cause**: `TodaySchedule` builds a key as `${med.id}_${scheduledAt.toISOString()}` where `scheduledAt` is constructed with `setHours(hh, mm, 0, 0)`. The alarm hook does the same but they may run at different `now` moments producing different date strings (same day but different base). The log's `scheduled_at` from the INSERT uses `scheduledAt.toISOString()` — so the key should match. But the SELECT in `loadSchedule` compares `l.scheduled_at` (a DB timestamp string) with a locally-built ISO string. Postgres may store it with different precision.
- **Fix**: Instead of exact string matching via Map key, match logs to slots by `medication_id` + hour/minute of `scheduled_at` (like `WardMedicationStatus` already does). This is more robust.

### 4. Prevent alarm hook from overwriting "taken" with "missed"
- In `useMedicationAlarms.ts`, the missed-dose detection checks `if (!existingLogs || existingLogs.length === 0)` before inserting a missed log. This is correct. But add an explicit check: also query by status to ensure we don't re-insert if a "taken" log exists.

## Files Modified

| File | Change |
|------|--------|
| `src/components/medications/TodaySchedule.tsx` | Hide taken doses, add snooze buttons, fix log matching |
| `src/hooks/useMedicationAlarms.ts` | Fix missed-dose detection to respect existing taken logs |

## Implementation Details

**TodaySchedule.tsx**:
- Add state: `hiddenTaken: Set<string>` for fade-out, `snoozeCount: Map<string, number>`, `snoozedUntil: Map<string, number>` (timestamp when snooze expires)
- Change log matching from exact ISO key to hour+minute matching (lines 85-89)
- Replace the Checkbox-only UI with: checkbox for "Take" + two small snooze buttons ("5m", "15m")
- After checkbox tick: toast success, add to `hiddenTaken`, reload
- Filter out `hiddenTaken` and `status === "taken"` from rendered list (keep in `doses` for progress)
- Add "Show taken (N)" collapsible at bottom
- After 3rd snooze expires without action: auto-mark missed, notify guardians

**useMedicationAlarms.ts**:
- Change missed-dose log query from `.select("id")` to `.select("id, status")` and skip insert if any log exists (regardless of status)

