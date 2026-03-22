

# Sleep Mode & Check-Out Mode with Green Heart

## Current State

- **Sleep Mode** exists on UserDashboard but is local state only — it just hides the CheckInCard. No visual indicator persists elsewhere.
- **Check-Out Mode** does not exist. This would signal "I'm going out / away" — guardians are informed, check-ins pause, but the user is explicitly accounted for.
- The **red pulsing heart** on the CheckInCard pulses red (`text-sos`) when a check-in is pending.
- Sleep mode state is not shared via AppContext, so the SOSButton and other components can't react to it.

## Suggestion

| Mode | Meaning | Heart | Check-ins | Guardian notification |
|------|---------|-------|-----------|----------------------|
| **Active** | Normal operation | Red pulsing | Running | On miss |
| **Sleep** | User is sleeping | Green steady | Paused | "Entered Sleep Mode" |
| **Checked Out** | User stepped out (errands, travel) | Green steady | Paused | "Checked Out" with optional return time |

Both modes share the same visual effect (green heart, no pulse) to signal "I'm okay, don't worry." The difference is semantic — Sleep is nighttime rest, Check-Out is daytime away.

## Plan

### 1. Add `pauseMode` to AppContext

Add a shared state `pauseMode: "active" | "sleep" | "checked-out"` with `setPauseMode()` to `AppContext`. This lets CheckInCard, SOSButton, and the dashboard all react to the mode.

### 2. Update UserDashboard — Replace Sleep toggle with mode selector

Replace the simple Sleep Mode switch with a card showing three states:
- **Active Mode** (Sun icon) — default
- **Sleep Mode** (Moon icon) — toggle on
- **Check-Out Mode** (DoorOpen icon) — toggle on, with optional "Expected return" time picker

Only one non-active mode can be on at a time. Activating one deactivates the other.

### 3. Update CheckInCard — Green heart when paused

When `pauseMode !== "active"`:
- Show a **green, non-pulsing heart** instead of the red pulsing one
- Display status text: "Sleep Mode — Check-iNs paused" or "Checked Out — Check-iNs paused"
- Skip creating/checking pending check-in records

### 4. Persist mode in user_settings

Store the current mode in the existing `user_settings` table via `useUserSettings` so it survives page refreshes and is available to the guardian view.

### 5. Notify guardians on mode change

When entering Sleep or Check-Out mode, insert a record or trigger a toast/push so guardians see "User entered Sleep Mode at 10:30 PM" or "User checked out — expected back by 3:00 PM."

---

## Files Changed

| File | Change |
|------|--------|
| `src/contexts/AppContext.tsx` | Add `pauseMode` / `setPauseMode` state |
| `src/pages/UserDashboard.tsx` | Replace sleep toggle with Active/Sleep/Check-Out selector |
| `src/components/CheckInCard.tsx` | Green heart + paused message when `pauseMode !== "active"` |
| `src/hooks/useUserSettings.ts` | Add `pauseMode` field to settings interface and defaults |

