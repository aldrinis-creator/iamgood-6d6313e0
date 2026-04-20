

## Issue

For guardians, `AQIWidget` still calls `navigator.geolocation.getCurrentPosition` to fetch AQI. If the guardian denies location (expected behavior — they shouldn't be queried for their own location), the widget errors out and the new params (humidity, rain, UV) — along with AQI itself — never render. Result: guardians see "--" and no popover content.

## Fix — `src/components/AQIWidget.tsx` (single file)

When `role === "guardian"`:

1. **Skip `navigator.geolocation` entirely.** Do not prompt the guardian for location.
2. **Use the ward's last known location** instead. Source it from `GuardianWardContext` → fetch `user_settings.settings.lastLocation` (`{ lat, lng }`) for the selected `wardUserId`. This is the same field already populated by `useLocationSync` and consumed by `GuardianDashboard`'s map.
3. **Fall back gracefully** if no ward location is available yet: show a friendly inline message ("Ward location not shared yet") inside the popover instead of the current silent `return null` on error, so the guardian understands why no data appears.
4. **Re-fetch when the selected ward changes** (effect dependency on `wardUserId`).
5. **Hide the search box for guardians** — already done via `role !== "guardian"` guard. Keep as-is.
6. **Disable the 10-min "revert to Current Location" timer for guardians** (no current-location concept for them).

Once the ward's coordinates flow in, the existing Open-Meteo call already returns humidity, precipitation, and UV — so all four params will render in the weather strip identically to the user view.

## Files to edit
- `src/components/AQIWidget.tsx` — branch on `role`, pull ward coords from `useGuardianWard()` + Supabase `user_settings`, skip geolocation for guardians, re-fetch on ward change.

## Out of scope
- Allowing guardians to manually search a different location (explicitly disallowed).
- Background polling of ward AQI for alerting (view-only as requested).

