

## Root cause

When the user taps the action button on a medication/check-in popup, two things break:

1. **`handleAction` does a full-page navigation via `window.location.href`** → the entire React app reloads → in-memory acknowledgement state in `ReminderOverlay.tsx` (`acknowledgedRef`, `showCountRef`) AND the throttling state in the alarm hooks (`postGraceRef`, `missedSentRef`, `firedRef`) is wiped. Within ≤30 seconds the `useMedicationAlarms` / `useCheckInAudio` interval re-fires the same overdue slot popup from scratch.
2. **The acknowledgement key includes a per-minute timestamp** (`[${formatISTDateTime(now)}]` is part of `message`, and `getReminderKey` hashes the message). So even without reload, the next tick produces a different key and bypasses `acknowledgedRef`.
3. **Result**: user lands on Medication / Check-iN tab, popup re-appears within seconds covering the screen — they can't tap "Mark taken" or "Check-In Now" before being interrupted again.

## Fix

### 1. Use SPA navigation instead of full reload — `src/components/ReminderOverlay.tsx`
- Replace `window.location.href = …` with `react-router-dom`'s `useNavigate()`. This keeps `acknowledgedRef` / counters intact across the navigation.

### 2. Make the acknowledgement key stable (slot-based, not message-based) — `src/components/ReminderOverlay.tsx`
- Extend `ReminderData` with an optional `slotKey?: string` (e.g. `"med-08:00"` or `"checkin-7"`).
- Change `getReminderKey` to prefer `slotKey` when present, falling back to current behavior for safety.
- Persist `acknowledgedRef` to `sessionStorage` so it survives any incidental reload (defence in depth).

### 3. Emit a stable `slotKey` from the alarm hooks
- **`src/hooks/useMedicationAlarms.ts`** — pass `slotKey: \`med-${dateKey}-${timeStr}\`` in every `showReminderOverlay({...})` call.
- **`src/hooks/useCheckInAudio.ts`** — pass `slotKey: \`checkin-${dateKey}-${h}\`` similarly.

### 4. Suppress re-firing for the same slot once acknowledged — alarm hooks
- Expose a small helper `isReminderAcknowledged(slotKey: string): boolean` from `ReminderOverlay.tsx` (reads the same `sessionStorage`-backed set).
- In both hooks, before scheduling/firing the next popup for a slot, skip if `isReminderAcknowledged(slotKey)` is true. This stops the 30s tick from re-opening the popup the user already acted on.
- For medications: clear the acknowledgement automatically once the underlying log row flips to `taken`/`taken_late` (so the slot is naturally cleaned up).

### 5. Grace window after action — `ReminderOverlay.tsx` + hooks
- After `handleAction`, set a short suppression window (e.g. 2 minutes) keyed by `slotKey` → during this window the overlay refuses to re-show even if the alarm hook calls `showReminderOverlay`. Gives the user uninterrupted time on the target tab to mark the medication taken or check in.

## Files to edit
- `src/components/ReminderOverlay.tsx` — switch to `useNavigate`, add `slotKey` field, sessionStorage-backed ack set, post-action suppression window, exported `isReminderAcknowledged`.
- `src/hooks/useMedicationAlarms.ts` — pass `slotKey`, skip firing when acknowledged.
- `src/hooks/useCheckInAudio.ts` — pass `slotKey`, skip firing when acknowledged.

## Out of scope
- Redesigning the overlay UX (still modal, still auto-dismissing).
- Changing the T-5 / T+5 / T+15 / T+25 cadence (works correctly; only re-fire-after-acknowledgement is buggy).
- Server-side cron behavior for missed-checkin guardian alerts (untouched).

