## Batch Medication Alerts for Same Time Slot

### Problem

When multiple medications are scheduled at the same time (e.g., 08:00), the system fires separate audio alerts, vibrations, browser notifications, and reminder overlays for each one. This creates a noisy, repetitive experience.

### Solution

Restructure the alarm check loop to **group medications by time slot first**, then fire one consolidated alert per slot containing all medication names.

### Changes

**File: `src/hooks/useMedicationAlarms.ts**`

Restructure the check function:

1. **Initial alarm (T+0)**: Instead of firing inside the per-med loop, collect all meds due at the same time slot into a `Map<timeStr, medName[]>`. After the loop, fire ONE alert per unique time slot:
  - One `playVoiceReminder` with all med names (e.g., "Your medications are due: Aspirin, Metformin")
  - One `showBrowserNotification` listing all meds
  - One `showReminderOverlay` with a combined message listing all meds
  - One vibration burst
  - The `slotKey` stays `med-slot-${dateKey}-${timeStr}` (already time-based, not per-med)
2. **Post-grace reminders (T+30 to T+60)**: Similarly batch — collect all untaken meds for a time slot, fire one combined reminder with all overdue med names.
3. **Final escalation (T+60-75)**: Keep per-med `medication_logs` inserts (each med needs its own missed log), but batch the audio/notification into one alert listing all missed meds for that slot. Even the Guardian notifications to follow the same logic.
4. **Guardian in-app notifications**: Already batched (fires once with `firedMedNames.join(", ")`), no change needed.

**File: `src/components/ReminderOverlay.tsx**`

- The "View Medications" action already navigates to `/my-health?tool=Tablets` — no change needed. Confirm the label says "View Medications" (it does).

### Technical approach

```typescript
// Phase 1: Collect slots
const initialSlots = new Map<string, string[]>(); // timeStr → medNames[]
const postGraceSlots = new Map<string, string[]>();
const finalSlots = new Map<string, { names: string[], meds: Array<{id, scheduledAt}> }>();

// Phase 2: Loop meds, populate maps (no alerts inside loop)

// Phase 3: Fire ONE alert per time slot from each map
for (const [timeStr, names] of initialSlots) {
  const combined = names.join(", ");
  playVoiceReminder(`Your medications are due: ${combined}`);
  showBrowserNotification("Medication Reminder", `Time to take: ${combined}`);
  showReminderOverlay({
    type: "medication",
    title: "Medication Reminder",
    message: `Time to take: ${combined}`,
    reminderCount: `Scheduled — ${timeStr}`,
  });
}
```

### Files to modify

- `src/hooks/useMedicationAlarms.ts` — restructure to batch alerts by time slot