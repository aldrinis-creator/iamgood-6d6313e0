

# Fix: Missing Notifications for Appointments, Check-Ins, and Medications

## Root Causes

1. **No appointment alarm hook exists.** Check-in and medication alarms have dedicated hooks (`useCheckInAudio`, `useMedicationAlarms`), but there is zero client-side alarm logic for appointments. The `first_alert` and `second_alert` fields are stored but never acted on.

2. **Browser throttles background tabs.** All alarm hooks use `setInterval(check, 30_000)`. When the app tab is in the background, browsers throttle intervals to 1 min or more — so the narrow 2-5 minute firing windows are easily missed entirely.

3. **AudioContext auto-suspend.** Web Audio requires a prior user gesture to play sound. If the user hasn't interacted with the page recently, `playChime()` silently fails.

4. **No browser Notification API usage.** Even when sounds can't play (background tab, no gesture), the app could show a system notification via `new Notification()`, but it doesn't.

## Plan

### 1. Create `src/hooks/useAppointmentAlarms.ts`
New hook that polls appointments due today and fires alerts based on `first_alert` / `second_alert` lead times:
- Fetch today's appointments where `alarm_enabled = true`
- For each, calculate alert times (e.g. "15min" before `start_date + start_time`)
- When current time falls within 2 minutes of an alert time, fire chime/voice + show `ReminderOverlay` with type "appointment"
- Track fired keys in a `useRef<Set>` to avoid repeats
- Poll every 30 seconds

### 2. Add `"appointment"` type to `ReminderOverlay`
- Extend `ReminderType` to include `"appointment"`
- Add an icon and action (navigate to `/appointments`) for appointment reminders

### 3. Add `useVisibilityResume` to all three alarm hooks
When the tab regains focus (`document.visibilitychange`), immediately run the check function instead of waiting for the next interval tick. This eliminates the "missed because tab was background" problem.

### 4. Use browser Notification API as fallback
In all three hooks, after playing chime/voice, also call `new Notification(title, { body })` if `Notification.permission === "granted"`. This ensures the user sees something even if:
- The tab is in the background (browser notifications appear system-wide)
- AudioContext is suspended

### 5. Wire `useAppointmentAlarms` into `AppLayout.tsx`
Add `useAppointmentAlarms()` call alongside existing `useCheckInAudio()` and `useMedicationAlarms()`.

## Files Changed
- **New**: `src/hooks/useAppointmentAlarms.ts` — appointment alarm polling hook
- **Edit**: `src/components/ReminderOverlay.tsx` — add "appointment" reminder type
- **Edit**: `src/components/AppLayout.tsx` — import and call `useAppointmentAlarms()`
- **Edit**: `src/hooks/useCheckInAudio.ts` — add visibility resume + browser Notification fallback
- **Edit**: `src/hooks/useMedicationAlarms.ts` — add visibility resume + browser Notification fallback
- **Edit**: `src/lib/audioAlerts.ts` — add `showBrowserNotification()` helper

