

# Add Real-Time "Start Session" Workout Tracker

## Overview
Add a "Start Session" button that launches a live workout session with a running timer, exercise type selection, and Start/Pause/Stop controls. When stopped, the session duration is saved to today's activity log (adding to `exercise_minutes` and `active_minutes`). The existing "Log Today" manual entry remains available for other metrics.

## No Database Changes
The existing `activity_logs` table already has `exercise_minutes`, `exercise_type`, and `active_minutes` columns — sufficient for session data.

## Changes to `src/components/ActivityTracker.tsx`

### New State & Logic
- Add session state: `sessionActive`, `sessionPaused`, `sessionStartTime`, `sessionElapsed`, `sessionExerciseType`
- Use `useRef` for an interval that ticks every second, updating elapsed time
- Pause/resume toggles the interval
- Stop calculates total minutes, adds them to today's form values (`exercise_minutes`, `active_minutes`), and auto-saves

### UI Changes
- Replace "Log Today" with a prominent **"Start Session"** button (Play icon) when no session is active
- Keep "Log Today" as a secondary action (renamed to "Manual Log") for entering sleep, heart rate, SpO2, etc.
- When session is active, show a **Session Card** with:
  - Exercise type selector (Walking, Running, Yoga, etc.)
  - Live elapsed timer (MM:SS format)
  - Pause/Resume button and Stop button
  - Estimated calories (basic calculation: ~5 kcal/min for moderate activity)
- On Stop: show a brief session summary, then save to today's log

### Button Layout
```text
[ Goals ]  [ Manual Log ]  [ ▶ Start Session ]
```
When session active:
```text
┌─────────────────────────────┐
│  🏃 Running Session         │
│  Exercise: [Walking ▼]      │
│  ⏱ 12:34                    │
│  ~62 kcal burned             │
│  [ ⏸ Pause ]  [ ⏹ Stop ]   │
└─────────────────────────────┘
```

