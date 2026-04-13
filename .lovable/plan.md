

## Medication Alerts: 1-Hour Hard Cutoff + "Taken Late" Status

### Problem
1. Reminders/alerts keep firing beyond 1 hour after the scheduled medication time.
2. If a user takes a tablet more than 1 hour late, it's recorded as "taken" — indistinguishable from an on-time dose.

### Solution

#### 1. Stop all reminders after 1 hour of scheduled time

**`src/hooks/useMedicationAlarms.ts`**:
- Change the post-grace escalation window from `diffMin >= 60 && diffMin < 1440` to fire reminders only **within** the first 60 minutes (e.g., reminders at ~60, ~70, ~80 min — 3 reminders at 10-min intervals starting from the 30-min mark, all completing before 60 min). After 60 minutes from scheduled time, no more alerts fire at all.
- Specifically: start post-grace reminders at 30 minutes past scheduled time (not 60), fire 3 at 10-min intervals (30, 40, 50 min), then send the final guardian SMS at ~60 min. After that, silence.
- The `diffMin >= 60` final escalation (guardian SMS + missed log) remains as the terminal action at the 1-hour mark, but no further reminders or sounds after that.

#### 2. Introduce "taken_late" status

**`src/components/medications/TodaySchedule.tsx`**:
- In `markTaken()`: check if `differenceInMinutes(now, slot.scheduledAt) > 60`. If yes, save status as `"taken_late"` instead of `"taken"`. Still decrement quantity and notify guardians (with status `"taken_late"`).
- Update the `DoseSlot` interface: add `"taken_late"` to the status union type.
- For "missed" slots (>1 hour past), show a "Taken" button so the user can still close the loop, but it records `"taken_late"`.
- In the completed doses section, show a distinct badge: "TAKEN LATE" (amber/warning color) vs "TAKEN" (green/success).

**`src/components/WardMedicationStatus.tsx`**:
- Treat `"taken_late"` as a taken dose for progress counting but display an amber "Late" badge.

**`src/pages/GuardianReports.tsx`**:
- Count `"taken_late"` separately in adherence charts so guardians can see on-time vs late compliance.

### Revised Escalation Timeline (per medication slot)

```text
T+0 min   → Initial alarm (sound + overlay + notification)
T+30 min  → Post-grace reminder 1/3
T+40 min  → Post-grace reminder 2/3
T+50 min  → Post-grace reminder 3/3 (final voice escalation)
T+60 min  → Guardian SMS + missed log written
T+60+ min → NO MORE ALERTS. "Taken" button stays visible → records "taken_late"
```

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useMedicationAlarms.ts` | Shift post-grace window to 30-60 min; hard stop at 60 min |
| `src/components/medications/TodaySchedule.tsx` | Add `taken_late` status; show Taken button on missed slots; amber badge for late |
| `src/components/WardMedicationStatus.tsx` | Handle `taken_late` display (amber badge) |
| `src/pages/GuardianReports.tsx` | Distinguish taken vs taken_late in adherence stats |
| `supabase/functions/notify-guardian-medication/index.ts` | Handle `taken_late` status in notification message |

No database migration needed — `medication_logs.status` is a text column that already accepts any string value.

