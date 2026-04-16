

## Four Changes: Ambulance Ungating, Guardian Dashboard Reorder, Notification/Popup Deconfliction, Revised Timing

### 1. Unlock Ambulance for All Plans

**`src/lib/featureGating.ts`**
- Move `"Ambulance"` from `"pro"` to `"free"` in `FEATURE_TIERS`
- Update its description to clarify it's available to all plans with pay-per-use tariff

### 2. Guardian Dashboard: Collapse Data Analysis + Reorder Medications Above Alerts

**`src/pages/GuardianDashboard.tsx`**
- **Medications section** (lines 933-978): Move it above the Alerts collapsible (lines 856-892), placing it right after the Quick Actions / Ambulance section
- **Data Analysis tile grid** (lines 980-1005): Replace with a collapsible that contains a single hyperlink "View Data Analysis →" which navigates to `/guardian/reports` (the existing GuardianReports page) in a new tab via `window.open`
- Remove the bottom Sheet for data analysis tiles (lines 1008-1044) since we no longer open sheets inline

### 3. Prevent Notification + Popup Overlap

**`src/components/ReminderOverlay.tsx`**
- Export a reactive flag `isOverlayVisible` (or use a global variable) that other hooks can check
- Set it `true` when overlay shows, `false` when it dismisses

**`src/hooks/useCheckInAudio.ts`, `src/hooks/useMedicationAlarms.ts`, `src/hooks/useAppointmentAlarms.ts`, `src/hooks/useExerciseReminder.ts`**
- Import the overlay visibility flag
- When about to fire a browser notification (`showBrowserNotification`) or audio alert, check if the overlay is currently visible — if so, skip the notification/audio (the popup is already demanding attention)
- The overlay itself handles its own audio via `ensureAudioReady`

### 4. Revised Reminder Timing: Notification at T-5, Popup at T+5, with 1/3, 2/3, 3/3 Reminders

**New timing model for medications and check-ins:**

```text
T-5 min  → Browser notification only (no popup, no overlay)
T+0      → (event is due, no immediate action)
T+5 min  → Popup overlay 1/3
T+15 min → Popup overlay 2/3
T+25 min → Popup overlay 3/3 (final escalation)
```

**`src/hooks/useMedicationAlarms.ts`**
- Add a **pre-alert** phase: 5 minutes before each scheduled time, fire `showBrowserNotification` only (no overlay, no audio). Track with `preAlertRef`
- Change initial alarm from T+0 to T+5: first overlay fires 5 min after scheduled time
- Post-grace reminders become 2/3 at T+15 and 3/3 at T+25 (intervals of 10 min)
- Keep escalation/guardian notification after 3/3 at ~T+30

**`src/hooks/useCheckInAudio.ts`**
- Same pattern: T-5 browser notification, T+5 popup 1/3, T+15 popup 2/3, T+25 popup 3/3
- Adjust constants: `PRE_ALERT_MIN = -5`, overlay starts at `+5`, reminders at 10-min intervals

**`src/hooks/useAppointmentAlarms.ts`**
- Already fires based on lead time config. Add: fire browser notification 5 min before the configured alert time, then popup at the configured alert time

**`src/hooks/useExerciseReminder.ts`**  
- Fire browser notification at T-5 (e.g., 7:55 AM), popup overlay at T+5 (8:05 AM)

**`src/components/ReminderOverlay.tsx`**
- Update `MAX_SHOWS` display text to show "1 of 3", "2 of 3", "3 of 3" (already does this via `reminderCount` from hooks)

### Files Summary

| File | Action |
|------|--------|
| `src/lib/featureGating.ts` | Move Ambulance to "free" |
| `src/pages/GuardianDashboard.tsx` | Reorder meds above alerts; collapse data analysis into link |
| `src/components/ReminderOverlay.tsx` | Export visibility flag for deconfliction |
| `src/hooks/useCheckInAudio.ts` | T-5 notification, T+5/+15/+25 popups |
| `src/hooks/useMedicationAlarms.ts` | T-5 notification, T+5/+15/+25 popups |
| `src/hooks/useAppointmentAlarms.ts` | T-5 notification before popup |
| `src/hooks/useExerciseReminder.ts` | T-5 notification, T+5 popup |

