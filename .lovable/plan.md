

# Simplify Medication Manager — Focus on Tablet-Taking Activity

## Current Problem

The Medication Manager has 6 tabs (Today, Meds, Scan, Refill, Banned, Alarms) all crammed into a single view. For the primary daily task — marking tablets as taken — the user must navigate to the "Today" tab among 5 other options. The tab labels are tiny and the layout is cluttered.

## Suggestion: Two-Level Layout

Restructure so the **Today Schedule is always visible first** (no tab needed), and secondary features are grouped behind a single "Manage" expandable section.

### Layout

```text
+----------------------------------+
|  Medication Manager              |
|                                  |
|  Today's Schedule (always shown) |
|  ┌────────────────────────────┐  |
|  │ 8:00 AM  Aspirin  [✓] [✗] │  |
|  │ 12:00 PM Metformin         │  |
|  │ 8:00 PM  Vitamin D         │  |
|  └────────────────────────────┘  |
|                                  |
|  ▸ Manage Medications            |
|    (Meds | Scan | Refill |       |
|     Banned | Alarms)             |
+----------------------------------+
```

### Changes

**File:** `src/components/medications/MedicationManager.tsx`

- Remove the 6-tab layout entirely
- Render `<TodaySchedule />` directly at the top — always visible, zero taps
- Add a `<Collapsible>` section labeled "Manage Medications" below
- Inside the collapsible, keep the existing 5 tabs (Meds, Scan, Refill, Banned, Alarms) as a smaller tab group
- Add a daily summary line above the schedule: "3 of 5 doses taken today" with a progress indicator

**File:** `src/components/medications/TodaySchedule.tsx`

- Add a compact summary header: taken/total count + progress bar
- Group doses by time period (Morning / Afternoon / Evening) with small headers for clarity
- Make the Take/Skip buttons slightly larger (h-10 instead of h-8) for elderly-friendly tapping

### No other files changed

The sub-components (MedicationList, PrescriptionScanner, RefillOrder, BannedMedications, AlarmSettings) remain as-is — they just live inside the collapsible section now.

## Files Changed

- `src/components/medications/MedicationManager.tsx` — replace tabs with always-visible schedule + collapsible manage section
- `src/components/medications/TodaySchedule.tsx` — add summary header, time-period grouping, larger action buttons

