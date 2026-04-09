

## Audio Alert Audit — Findings and Fixes

### Analysis Summary

I audited every location that calls `playChime()`, `playVoiceReminder()`, or `showBrowserNotification()` across the codebase. Here are the findings:

---

### WORKING CORRECTLY (no changes needed)

| Alert Source | Audio | Overlay | Browser Notif | Gated by Settings | Notes |
|---|---|---|---|---|---|
| **Check-in reminders** (`useCheckInAudio`) | ✅ | ✅ | ✅ | ✅ | Fires at 7/12/19, missed detection works |
| **Medication alarms** (`useMedicationAlarms`) | ✅ | ✅ | ✅ | ✅ | 30s poll, per-slot dedup |
| **Appointment alarms** (`useAppointmentAlarms`) | ✅ | ✅ | ✅ | ✅ | Lead-time based, 30s poll |
| **Exercise reminder** (`useExerciseReminder`) | ✅ | ✅ | ✅ | ✅ | 8AM/6PM, gated by `exerciseReminder` setting |
| **Battery warning** (`BatteryWarning`) | ✅ | ✅ (custom) | ❌ (by design) | ✅ | 3 max per phase, auto-dismiss |
| **Medication alarm settings** (`AlarmSettings`) | ✅ | N/A | N/A | N/A | Test button only |
| **Guardian dashboard realtime** | ✅ | ❌ (by design) | ❌ | ✅ (`guardianVoiceAlerts`) | SOS/fall/missed alerts |
| **Guardian alerts page realtime** | ✅ | ❌ (by design) | ❌ | ✅ (`guardianVoiceAlerts`) | Duplicate of dashboard logic |

---

### ISSUES FOUND

**1. GuardianPingOverlay — NO audio alert when user receives a ping**
- **File**: `src/components/GuardianPingOverlay.tsx` line 57
- Currently only does `navigator.vibrate()` — no chime or voice alert
- A guardian ping is an important event; the user should hear it
- **Fix**: Add `playChime()` call when a ping arrives

**2. FallDetectionOverlay — NO audio/alarm during countdown**
- **File**: `src/components/FallDetectionOverlay.tsx`
- When a fall is detected, the overlay shows visually but plays NO sound
- For an elderly user who may be disoriented after a fall, an audible alarm is critical
- **Fix**: Play a repeating alarm tone during the 15-second countdown (and stop on cancel)

**3. JourneyAlertOverlay — NO audio on route deviation or arriving**
- **File**: `src/components/JourneyAlertOverlay.tsx`
- Pure visual overlay with no audio/vibration
- Route deviation is a safety-critical event
- **Fix**: Play chime/voice on mount based on alert type

**4. `exerciseReminder` setting — may not exist in defaults**
- **File**: `src/hooks/useExerciseReminder.ts` line 23
- The hook checks `settings.exerciseReminder` but this field may not be in the default settings, causing the reminder to never fire for users who haven't toggled it
- **Fix**: Verify the default value exists in `useUserSettings` defaults; if missing, add `exerciseReminder: true`

---

### Implementation Plan

| Step | What |
|---|---|
| 1 | Check `useUserSettings` defaults for `exerciseReminder` field |
| 2 | Add `playChime()` to `GuardianPingOverlay` on ping received |
| 3 | Add repeating alarm sound to `FallDetectionOverlay` during countdown |
| 4 | Add audio + vibration to `JourneyAlertOverlay` based on type |
| 5 | Add `exerciseReminder` default if missing |

### Files to Modify

- `src/components/GuardianPingOverlay.tsx` — add chime on ping
- `src/components/FallDetectionOverlay.tsx` — add alarm during countdown
- `src/components/JourneyAlertOverlay.tsx` — add audio on mount
- `src/hooks/useUserSettings.ts` — verify/add `exerciseReminder` default (if missing)

### Technical Detail

All scheduled hooks (`useCheckInAudio`, `useMedicationAlarms`, `useAppointmentAlarms`, `useExerciseReminder`) correctly use the `ensureAudioReady()` → `playChime()`/`playVoiceReminder()` pattern with the AudioContext unlock-on-gesture approach. The core audio infrastructure in `audioAlerts.ts` is sound — the issues are purely about missing audio calls in 3 event-driven overlays.

