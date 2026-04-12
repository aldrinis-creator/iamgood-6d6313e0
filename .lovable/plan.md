

## Two Changes: Reminder Overlay Timing + Health Pattern Alert on Guardian Dashboard

### Part 1: Reminder Overlay — Auto-dismiss after 30s, max 3 shows at 5-min intervals

**Current behavior**: Overlay stays visible indefinitely until user clicks Snooze/Dismiss/Action. Snooze interval is 10 minutes with manual snooze required.

**New behavior**:
- Overlay auto-dismisses after 30 seconds if user does not interact
- If not acknowledged (action button clicked), it automatically re-appears after 5 minutes
- Maximum 3 appearances total per reminder slot — then escalation fires (guardian notification for meds, toast for others)
- No manual "Snooze" button needed — the auto-cycle replaces it
- "Dismiss" button still available to manually close early (counts as non-acknowledgment, timer continues)
- Only the **Action button** (e.g. "View Medications") counts as acknowledgment and stops the cycle

**Files to modify**:
| File | Change |
|------|--------|
| `src/components/ReminderOverlay.tsx` | Add 30s auto-dismiss timer, remove snooze button, auto-reschedule at 5-min intervals up to 3 times, track acknowledgment vs dismissal |

### Part 2: Health Pattern Alert — Explanation and Guardian Dashboard Display

**How it works today**: The `useAbnormalPatternCheck` hook runs every hour on the user's device. It calls the `detect-anomalous-patterns` edge function which:
1. Fetches 14 days of activity logs, check-ins, and wellness data
2. Runs heuristic checks: no activity today, 2+ missed check-ins in 24h, declining mood trend, elevated heart rate (>100 avg), low SpO2 (<94 avg)
3. If anomalies found, calls Gemini to generate a caring 2-3 sentence summary
4. Creates an in-app notification (deduped) for the user, and if severity is "high" (vitals-related), also notifies guardians
5. Shows a toast on the user's screen

**What the user sees**: The "Health pattern alert detected" toast at the bottom of the screenshot. It's informational — the user should review their health data and consider consulting a doctor if needed.

**What's missing**: The guardian dashboard doesn't display these anomaly alerts prominently. They arrive as generic notifications but aren't called out visually.

**New behavior**:
- Add a dedicated "Health Pattern Alert" card on the Guardian Dashboard that shows anomaly notifications for the selected ward
- Only display alerts from the last 24 hours (filter by `created_at`)
- Card shows the AI-generated summary with an alert icon and amber/orange styling
- Auto-hides after 24 hours from the event timestamp

**Files to modify**:
| File | Change |
|------|--------|
| `src/pages/GuardianDashboard.tsx` | Filter notifications for `type === "anomaly"` created within 24h, render a dedicated alert card above the regular notifications section |

### No database or edge function changes needed

Both changes are purely client-side UI/timing modifications.

