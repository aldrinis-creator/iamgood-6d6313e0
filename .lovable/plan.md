

## Three Fixes: Face Scan in Health Passport, Trend Auto-Collapse, and Medication Escalation

### Issue 1: No Visible Face Scan in Health Passport

Face scan data IS currently used as a fallback inside the "Vitals" score calculation (lines 122-144 of HealthPassport.tsx), but there is no separate visible row for it. The user sees 6 categories: Check-iN, Activity, Wellness, Medications, Vitals, Nutrition — with no mention of "Face Scan."

**Fix**: Add a 7th category row called "Face Scan" that scores based on whether the user completed a scan today (has a `face_scans` record) and the quality of results (HR in healthy range, low stress). The overall score denominator changes from 6 to 7. Same change in `WardHealthPassport.tsx`.

### Issue 2: Score Trend Auto-Collapse After Inactivity

Currently the "Score Trend" collapsible stays open indefinitely until manually closed.

**Fix**: Add a 5-minute inactivity timer to `HealthPassportTrend.tsx`. When the section is opened, start a timer. If no user interaction (tab switch, hover) occurs within 5 minutes, auto-collapse it. Reset the timer on any interaction.

### Issue 3: Medication — No Escalation After 3 Reminder Snoozes

Current behavior when a medication reminder fires:
- `useMedicationAlarms` shows a `ReminderOverlay` (fires once per slot)
- User can snooze the overlay 3 times (5 min each)
- After 3rd snooze, overlay dismisses with a generic toast: "Maximum snoozes reached"
- **No escalated audio alert fires**
- **No guardian nudge is sent at that moment**

The guardian notification only happens later when `useMedicationAlarms` detects the dose is 60+ minutes overdue and writes a "missed" log. That's a separate path, not tied to the 3-snooze exhaustion.

**Fix**: In `ReminderOverlay.tsx`, when `used >= MAX_SNOOZES` for a medication reminder:
1. Play an escalated audio alert (urgent chime + voice: "You have not taken your medication after 3 reminders")
2. Call `notify-guardian-medication` edge function with status "missed" immediately (don't wait for the 60-min detection)
3. Show a more prominent toast ("Medication not taken — your guardian has been notified")

---

### Files to Modify

| File | Change |
|------|--------|
| `src/components/HealthPassport.tsx` | Add "Face Scan" as 7th category; adjust overall to /7 |
| `src/components/WardHealthPassport.tsx` | Same Face Scan category addition |
| `src/components/HealthPassportTrend.tsx` | Add 5-min inactivity auto-collapse timer |
| `src/components/ReminderOverlay.tsx` | On 3rd snooze for medication: play escalated audio + notify guardians |

### Technical Detail

**Face Scan scoring** (0-100):
- 40 points for having any scan today
- 30 points for HR in healthy range (50-100 bpm)
- 30 points for low stress (stress_score < 50)

**Trend auto-collapse**: `useEffect` with a `setTimeout(5 * 60_000)` that calls `setOpen(false)`. Reset on `period` change or mouse enter. Clear on unmount/close.

**Medication escalation**: Extract the guardian notification call into a shared helper. When `used >= MAX_SNOOZES` and `reminder.type === "medication"`, call `playVoiceReminder("You have not taken your medication...")`, then fire the edge function. The user's ID is not available in ReminderOverlay, so we dispatch a custom event `app:medication-snooze-exhausted` that `useMedicationAlarms` listens for and handles the guardian notification.

