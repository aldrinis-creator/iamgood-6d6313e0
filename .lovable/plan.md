

# Fix: Audio Notifications Should Respect Pause Mode

## Problem
`useCheckInAudio` and `useMedicationAlarms` fire alerts even when the user is in Sleep or Check-Out mode. Both hooks need to check `pauseMode` and skip alerts when paused.

## Changes

### 1. `src/hooks/useCheckInAudio.ts`
- Import `useApp` from `AppContext`
- Read `pauseMode` from context
- At the top of `check()`, early-return if `pauseMode !== "active"`
- Add `pauseMode` to the `useEffect` dependency array

### 2. `src/hooks/useMedicationAlarms.ts`
- Import `useApp` from `AppContext`
- Read `pauseMode` from context
- At the top of `check()`, early-return if `pauseMode !== "active"`
- Add `pauseMode` to the `useEffect` dependency array

### 3. Cleanup: Remove unused `playMedicationVoice` export
- Remove the dead `playMedicationVoice` function from `src/lib/audioAlerts.ts` (optional, low priority)

## Impact
Two files changed, ~4 lines each. No UI changes. Ensures silent operation during Sleep/Check-Out modes.

