

# Fix Guardian App Issues (12 Items)

## Root Cause: Audio Alerts Playing on Guardian App
`AppLayout.tsx` unconditionally runs `useCheckInAudio()`, `useMedicationAlarms()`, `useAppointmentAlarms()`, and `useExerciseReminder()` for ALL roles. These hooks fire medication/check-in reminders meant only for the "user" role. Guardians hear the User's own reminders.

**Fix**: Wrap those 4 hook calls in a `role === "user"` guard inside `AppLayout.tsx`.

---

## Item-by-Item Changes

### 1. Stop medication/check-in audio on Guardian app
**File**: `src/components/AppLayout.tsx`
- Only call `useCheckInAudio()`, `useMedicationAlarms()`, `useAppointmentAlarms()`, `useExerciseReminder()` when `role === "user"`.

### 2. SOS banner still showing from 3:21 AM
**File**: `src/pages/GuardianDashboard.tsx`
- The SOS query fetches `status = 'active'` — if the SOS was never resolved/cancelled, it persists. Add auto-stale logic: treat SOS older than 2 hours as stale. Show a "Resolve" button for guardian to dismiss stale SOS banners. When clicked, update `sos_events.status = 'resolved'` (requires new RLS policy for guardian UPDATE on sos_events).
- **Migration**: Add RLS policy allowing guardians to UPDATE `sos_events` for their wards (to resolve stale alerts).

### 3. Auto-dismiss medication alerts after 1 hour
**File**: `src/pages/GuardianDashboard.tsx` and `src/pages/GuardianAlerts.tsx`
- When displaying medication notifications, filter out those with `created_at` older than 1 hour OR auto-mark them as read. Implement in the notification display logic: if `type` includes "medication" and `created_at` is >1 hour ago, auto-mark as read.

### 4. Build the Call button properly
Already built with dropdown (Phone/WhatsApp) at line 458-474. Will verify it's functional — it's there and working. No change needed unless the dropdown isn't opening (UI issue).

### 5. Build Ping button with reply flow on User's app
**File**: `src/components/GuardianPingDialog.tsx` — already built and working.
**New**: Add a listener in the User's app to show incoming pings as an animated overlay with a reply option.
- **File**: `src/components/GuardianPingOverlay.tsx` (new) — realtime subscription on `guardian_pings` for `user_id = auth.uid()`. Shows animated toast/overlay with the message and a "Reply" button. Reply inserts a new `guardian_pings` row back (user→guardian direction).
- **File**: `src/components/AppLayout.tsx` — include `GuardianPingOverlay` for user role.
- **Migration**: Add RLS policy for users to INSERT into `guardian_pings` (for replies, with `user_id = auth.uid()` as sender).

### 6. Audio alert after 3 missed medication reminders
**File**: `src/pages/GuardianDashboard.tsx`
- In the notification realtime handler, track consecutive medication_missed notifications. After 3 for the same time period (morning/afternoon/evening), trigger voice: `"{wardName} has not taken their morning medication."` 
- Same logic for check-in: after 3 missed check-in notifications, voice alert.

### 7. Battery Charge % + Last Active
**File**: `src/pages/GuardianDashboard.tsx`
- Battery % is device-local (navigator.getBattery). The guardian can't read the User's battery remotely without the User reporting it. 
- **Solution**: Store User's battery level in `user_settings.settings.batteryLevel` periodically from `BatteryWarning.tsx`. Guardian dashboard reads it from `user_settings`.
- **File**: `src/components/BatteryWarning.tsx` — add periodic save of battery level to `user_settings`.
- Display battery % alongside Last Active in the status card on guardian dashboard. If ≤30%, show popup + audio: `"Please ask {wardName} to charge their phone now!"`

### 8. SOS/Fall trigger includes Emergency Health Card + profile + vitals
**File**: `src/pages/GuardianDashboard.tsx`
- When `activeSOS` is present, auto-show `WardEmergencyCard` and `WardVitalsSummary` prominently at the top (already shows at bottom — move/duplicate into the SOS banner area).

### 9. Current Medication tab: Guardian can order/scan/buy
**File**: `src/pages/GuardianServices.tsx` or `src/pages/GuardianDashboard.tsx`
- Import and render `MedicationManager`-like components (RefillOrder, PrescriptionScanner, JanAushadhiAlternatives) scoped to `wardUserId`. This requires the guardian to have SELECT access to ward's medications (already has RLS).

### 10. Battery % display + low battery popup for guardian
Covered in item 7 above.

### 11. Location sharing toggle — default ON
Already implemented: `shareLocationWithGuardian !== false` defaults to `true`. The toggle exists in Settings → Privacy. No change needed.

### 12. Collapsible/dropdown sections for clean screen
**File**: `src/pages/GuardianDashboard.tsx`
- Wrap each section in a `Collapsible` component (from shadcn):
  - "{User}'s Medications" (WardMedicationStatus + WardMedicationAdherence)
  - "{User}'s Health" (WardHealthPassport)
  - "Emergency Health Card" (WardEmergencyCard)
  - "{User}'s Vitals" (WardVitalsSummary)
  - "{User}'s Activity" (WardActivitySummary)
  - "Care Journal" (CareJournal)
- Default: collapsed. SOS/Fall sections stay expanded.

---

## Database Migration
- Add guardian UPDATE policy on `sos_events` for resolving stale alerts
- Add user INSERT policy on `guardian_pings` for reply messages (user replying to guardian)

## Files Changed

| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | Guard hooks behind `role === "user"`, add PingOverlay |
| `src/pages/GuardianDashboard.tsx` | Collapsible sections, SOS stale logic, battery display, medication ordering, auto-dismiss, missed-dose audio |
| `src/pages/GuardianAlerts.tsx` | Auto-dismiss old medication alerts |
| `src/components/BatteryWarning.tsx` | Save battery % to user_settings periodically |
| `src/components/GuardianPingOverlay.tsx` | New — User sees pings + can reply |
| `supabase/migrations/` | New — RLS for guardian SOS update, user ping reply |

## Implementation Order
1. Fix AppLayout hook guards (stops guardian audio immediately)
2. Database migration
3. SOS stale resolve + collapsible sections
4. Battery reporting + guardian display
5. Ping overlay with reply
6. Missed medication/check-in escalation audio
7. Auto-dismiss old medication alerts

