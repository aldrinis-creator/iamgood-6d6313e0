

# Pre-Launch Audit: Notifications, Audio Alerts & Font Sizes

## Audit Findings

### What's Working
- Check-in **due** alerts (audio + overlay) fire at 7AM/12PM/7PM within first 5 minutes
- Check-in **missed** alerts fire at 30 min past the hour if no response
- Medication alarms fire within 2 minutes of each scheduled time (chime/voice based on settings)
- Both hooks correctly respect Sleep/Check-Out pause modes
- Guardian DB notifications are created when medications are marked taken/skipped (via `TodaySchedule`)
- Server-side edge function (`check-missed-checkins`) handles missed check-in guardian notifications

### Issues Found

1. **Font sizes too small** — ReminderOverlay uses `text-2xl`/`text-lg` and NotificationCenter uses `text-sm`/`text-xs`/`text-[10px]`. For an elderly-focused app, these need to be significantly larger.

2. **Medication overlay "View Medications" button does nothing useful** — It just dismisses the overlay. It should navigate the user to the Medication Manager tab.

3. **No in-app DB notification created for medication due/missed alarms** — The `useMedicationAlarms` hook fires audio + overlay but does NOT insert a notification row. Guardians only get notified when the user explicitly marks taken/skipped in TodaySchedule.

4. **NotificationCenter bell icon is small (w-5 h-5)** — Should be larger for accessibility.

---

## Plan

### 1. Enlarge ReminderOverlay fonts (`src/components/ReminderOverlay.tsx`)
- Title: `text-2xl` -> `text-3xl`
- Message: `text-lg` -> `text-xl`
- Reminder count: `text-base` -> `text-lg`
- Action button: `text-xl` -> `text-2xl`, increase padding
- Icon sizes: `w-8 h-8` -> `w-10 h-10`, button icons `w-6 h-6` -> `w-8 h-8`
- Dismiss text: `text-base` -> `text-lg`

### 2. Enlarge NotificationCenter fonts (`src/components/NotificationCenter.tsx`)
- Notification title: `text-sm` -> `text-base`
- Notification message: `text-xs` -> `text-sm`
- Timestamp: `text-[10px]` -> `text-xs`
- Sheet title: `text-lg` -> `text-xl`
- Empty state text: `text-sm` -> `text-base`
- Bell icon: `w-5 h-5` -> `w-6 h-6`
- Badge: increase min size

### 3. Fix medication overlay action (`src/components/ReminderOverlay.tsx`)
- When type is `"medication"`, dispatch a custom event `app:navigate-medications` and listen for it in `AppLayout` or use `window.location` to navigate to `/my-health` (where MedicationManager lives)

### 4. Create guardian notification on medication alarm fire (`src/hooks/useMedicationAlarms.ts`)
- After firing the overlay, insert a notification row into `notifications` for each guardian (same pattern as `UserDashboard.notifyGuardians`)
- This ensures guardians see "Medication reminder triggered" in their Notification Center in real-time

---

## Files Changed
- `src/components/ReminderOverlay.tsx` — larger fonts + medication navigation
- `src/components/NotificationCenter.tsx` — larger fonts throughout
- `src/hooks/useMedicationAlarms.ts` — add guardian notification insert on alarm fire

