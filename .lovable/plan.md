

# Add Ward Medication Status Card to Guardian Dashboard

## What Changes

Add a read-only "Today's Medications" card to the Guardian Dashboard showing the ward's medication schedule with taken/missed/pending status for each dose — mirroring what the user sees in their own TodaySchedule but without action buttons.

## Approach

### 1. New Component: `WardMedicationStatus`

**File:** `src/components/WardMedicationStatus.tsx`

- Accepts `wardUserId` and `wardName` props
- Fetches ward's `medications` (name, dosage, schedule_times) and today's `medication_logs` (status, scheduled_at) — RLS already permits guardian SELECT on both tables
- Builds a dose list grouped by time, showing: time, medication name, and status badge (Taken/Missed/Pending)
- Progress bar at top: "3 of 5 doses taken"
- Read-only — no checkboxes or action buttons
- Realtime subscription on `medication_logs` for live updates when the ward takes a dose

### 2. Add to Guardian Dashboard

**File:** `src/pages/GuardianDashboard.tsx`

- Import `WardMedicationStatus`
- Render `{wardUserId && <WardMedicationStatus wardUserId={wardUserId} wardName={wardName} />}` between the Check-Ins card and Ward Health Passport

## No Database Changes

RLS policies already allow guardians to SELECT from `medications` and `medication_logs` via the guardian phone match pattern.

## Files Changed

- `src/components/WardMedicationStatus.tsx` — new component
- `src/pages/GuardianDashboard.tsx` — add the card

