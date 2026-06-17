## Why the overlay always says "Reminder 1 of 3"

The overlay (`src/components/ReminderOverlay.tsx`) renders **two counters**:

1. `reminder.reminderCount` — passed in by the source hook (e.g. `useMedicationAlarms`, `useCheckInAudio`) using its own authoritative `state.count` (1 → 2 → 3, persisted in `postGraceRef`).
2. `Reminder {currentShow} of {MAX_SHOWS}` — the overlay's *own* counter, read from `showCountRef` (a `useRef(new Map())` local to the `ReminderOverlay` component instance).

The second counter resets to 1 every time the `ReminderOverlay` component re-mounts. That happens in `AppLayout.tsx`:

```tsx
{!loginInProgress && <ReminderOverlay />}
```

Anything that flips `loginInProgress`, or any parent re-mount (route swaps that re-evaluate `AppLayout`'s tree, `GuardianOnlyHooks` / `UserOnlyHooks` branch swaps, etc.) tears down `ReminderOverlay`, wiping `showCountRef`. The next fire comes in fresh → `currentShow` = 1 again. Meanwhile the hook's `postGraceRef` lives in a long-lived hook, so its count is the real one.

Net effect: the bottom line ("Reminder 1 of 3 · Auto-closes in 10s") is stuck at 1, while the line above it (from `reminder.reminderCount`, e.g. "Reminder 2 of 3 — 08:00") is correct.

## Fix

Make the overlay's counter authoritative and persistent, and stop showing a second, conflicting line.

### Changes — `src/components/ReminderOverlay.tsx` only

1. **Promote `showCountRef` to module scope** so it survives re-mounts:
   ```ts
   const showCounts = new Map<string, number>();
   ```
   Replace all `showCountRef.current` reads/writes with `showCounts`. Drop the `useRef` for it.

2. **Render a single counter line.** Prefer the hook-supplied label when present, otherwise fall back to the internal count:
   ```tsx
   <p className="text-sm text-muted-foreground">
     {reminder.reminderCount ?? `Reminder ${currentShow} of ${MAX_SHOWS}`}
     {" · Auto-closes in 10s"}
   </p>
   ```
   Remove the separate `{reminder.reminderCount && (...)}` block so we never render two counters.

3. **Clear the count on acknowledged dismiss** (`dismiss(true)`), so a future, un-suppressed fire for the same slot starts from 1 cleanly:
   ```ts
   if (acknowledged && reminder) {
     showCounts.delete(getReminderKey(reminder));
     ...
   }
   ```

No changes to hooks, no changes to audio/voice logic, no DB/edge-function work. Counters across all reminder types (check-in, medication, appointment, exercise) will now reflect the true Nth reminder.