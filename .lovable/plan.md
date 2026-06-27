## Goal
Remove visual clutter from the home screen and give the Check-iN heart card more visual prominence, while keeping all mode controls accessible in Settings.

## Changes

### 1. Remove mode selector band from Home screen
In `src/pages/UserDashboard.tsx`:
- Remove the entire mode-selector `Card` (lines 234-273) including the Active/Sleep/Checked Out buttons and the pause-mode info lines.
- Keep the `handleModeChange`, `handleSleepSave`, `handleCheckOutSave`, `returnToActive`, `notifyGuardians`, and auto-return `useEffect` logic in place — they still run in the background and keep the app functional.
- Keep `SleepModeDialog` and `CheckOutSettingsDialog` imports and JSX, because they will now be triggered from Settings instead.

### 2. Add mode controls to Settings > Check-In tab
In `src/pages/Settings.tsx` under the `activeTab === "checkin"` block:
- Insert a new card at the top of the Check-In tab named "Check-iN Mode".
- Add the three mode buttons (Active, Sleep, Checked Out) with the same styling/logic as today.
- Wire them to a local state wrapper that calls `updateSetting("pauseMode", mode)` and triggers the same save flows (sleep schedule dialog, checkout dialog).
- Re-use the existing `SleepModeDialog` and `CheckOutSettingsDialog` components. They can be rendered inside Settings and controlled with local `useState` booleans, or they can remain in `AppLayout` / a shared outlet if easier. The simplest path: import and mount them inside Settings with local open/close state, because `AppLayout` is already used by Settings.

### 3. Enlarge Check-iN heart card
In `src/components/CheckInCard.tsx`:
- Increase heart icon size from `w-16 h-16` to `w-24 h-24` in the main interactive states (approaching & default unchecked-in).
- Increase checked-in heart from `w-20 h-20` to `w-28 h-28`.
- Increase greeting/status font from `text-accessible` to `text-xl font-semibold` (still within accessible range, but bolder).
- Increase the radial-gradient container proportionally (`w-28 h-28` → `w-36 h-36` for unchecked, `w-32 h-32` → `w-40 h-40` for checked-in).
- Increase sub-labels under the heart from `text-sm` to `text-base` where appropriate.

### 4. Update paused-mode instruction text
In `CheckInCard.tsx` inside the `isPaused` branch:
- Replace:
  "Tap Active in the mode selector above to resume check-ins."
- With:
  "To change mode to Active, go to Settings."

### 5. Keep existing auto-return behavior
- `UserDashboard` still hosts the `useEffect` that auto-returns from sleep/checkout when timers expire. No logic change needed — only the UI band is removed.
- If `CheckInCard` needs to know the current pause mode, it already reads `pauseMode` from `useApp()`, so nothing changes there.

## Out of scope
- No changes to `AppContext`, `useUserSettings`, or the underlying mode data model.
- No changes to bottom NavTabs or AppHeader.
- No redesign of the Settings tab grid or navigation.

## Result
- Home screen loses one full card of controls, creating more whitespace.
- The Check-iN card becomes the clear focal point with a larger heart and larger text.
- Mode switching is still one tap away inside Settings > Check-In.