

# Fix: Ward Battery Display + Guardian Battery Alert

## Issues Found

1. **Ward battery always "N/A"**: `fetchWardSettings` (line 203) only selects `settings` column but tries to read `updated_at` from the response (line 218). More importantly, the `batteryLevel` key is being saved correctly by the User's `BatteryWarning`, but the select query is missing the `updated_at` field for the timestamp display.

2. **Guardian's own battery alert not firing**: The `BatteryWarning` component renders for all roles (AppLayout line 86), so guardians should get alerts. However, the component's `show()` function reads from `settingsRef` which depends on `useUserSettings`. If the guardian has no `user_settings` row yet (common for new guardians), `settings` defaults to `DEFAULTS` with `voiceReminders: true` and `audioAlerts: true` — so it should work. The real issue is likely that `getBattery()` returns a promise that silently fails on the guardian's browser, and while we added polling, the polling only runs after the initial `.then()` succeeds. If `getBattery()` rejects, no polling starts.

## Changes

### `src/pages/GuardianDashboard.tsx`
- Fix `fetchWardSettings` select to include `updated_at`: `.select("settings, updated_at")`
- Add a periodic poll (every 2 minutes) of the ward's `user_settings` to keep battery level fresh, since the realtime subscription already handles this but may miss updates

### `src/components/BatteryWarning.tsx`
- Move the polling interval setup outside the `.then()` block so it still runs even if `getBattery()` rejects
- This ensures guardian phones that support the API but have a delayed promise still get polled

No database changes needed. Two files modified.

