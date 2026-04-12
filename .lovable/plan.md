## Fix: Triple SMS for Missed Medication and Correct Escalation Flow

### Root Cause — 3 Separate Notification Paths

When a medication is missed, THREE independent paths all fire guardian notifications:

1. `**useMedicationAlarms.ts` line 119** — 60-min missed-dose detection writes a "missed" log and calls `notifyGuardiansMissed`
2. `**useMedicationAlarms.ts` line 170** — Listens for `app:medication-snooze-exhausted` event (from ReminderOverlay after 3 snoozes) and calls `notifyGuardiansMissed` again
3. `**TodaySchedule.tsx` line 245** — `autoMarkMissed()` calls `notifyGuardians` with status "missed" when TodaySchedule's own snooze limit is hit

All three can fire for the same dose slot → 3 SMS messages.

### Desired Flow (per the user's specification)

```text
Medication time → Initial reminder fires
    ↓
1-hour grace period (user can take medication anytime)
    ↓
After 60 minutes if not taken:
    Reminder 1 fires → wait 10 min
    Reminder 2 fires → wait 10 min
    Reminder 3 fires → wait 10 min
    ↓
If still not taken after 3 post-grace reminders:
    → Send ONE missed medication SMS to guardian
    → Play escalated audio alert to user
    → Write "missed" log
```

### Changes


| File                                           | Change                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/hooks/useMedicationAlarms.ts`             | At 60-min mark: instead of immediately writing "missed" log + SMS, start a 3-reminder sequence at 10-min intervals. Only after all 3 are exhausted, write the missed log and send ONE guardian notification. Remove the separate `app:medication-snooze-exhausted` listener (no longer needed as a separate path). |
| `src/components/ReminderOverlay.tsx`           | Change snooze interval from 5 min to 10 min. Remove the `app:medication-snooze-exhausted` event dispatch — the escalation is now handled entirely by `useMedicationAlarms`.                                                                                                                                        |
| `src/components/medications/TodaySchedule.tsx` | Remove the `notifyGuardians(..., "missed", ...)` call from `autoMarkMissed()`. TodaySchedule should only write the database log, not send SMS. The alarm hook handles SMS.                                                                                                                                         |


### Technical Detail

**useMedicationAlarms** new logic at the 60-min detection point:

- Track a `postGraceReminders` ref: `Map<string, number>` (slot key → reminder count)
- At 60 min past: if count < 3, show a `ReminderOverlay`, increment count, and DON'T write missed log yet
- At 90 min (count 1), 100 min (count 2), 110 min (count 3): each `check()` cycle re-fires
- After count reaches 3 and another 10 min passes with no "taken" log: write missed log, call `notifyGuardiansMissed` ONCE, play escalated audio

**ReminderOverlay** changes:

- `SNOOZE_MS` from `5 * 60_000` to `10 * 60_000`
- Remove the `window.dispatchEvent(new CustomEvent("app:medication-snooze-exhausted"))` line — the overlay still shows the 3-snooze UI but doesn't trigger SMS independently

**TodaySchedule** changes:

- In `autoMarkMissed()`, remove the `notifyGuardians(...)` call on line 245. Keep the database insert/update for the missed log.

This ensures exactly ONE SMS is sent, only after the full escalation sequence (1 hour grace + 3 reminders at 10-min intervals = ~90 minutes after scheduled time).  
  
Do this for all MIssed Medications, Check-iNs