

## Guardian AQI: View-Only, No Location Search

### Change
Pass the user's `role` from `useApp()` into `AQIWidget`. When role is `"guardian"`:
- Show AQI data normally (current location auto-fetch still works)
- Hide the search bar section entirely
- If the location name area is tapped, show a toast: "Subscribe as a User"

### Files

**`src/components/AppHeader.tsx`**
- Pass `role` to AQIWidget: `<AQIWidget role={role} />`

**`src/components/AQIWidget.tsx`**
- Add `role?: "user" | "guardian"` prop (default `"user"`)
- Wrap the search bar section (lines ~225-260) with `{role !== "guardian" && (...)}`
- On the location name `<p>` element, add an `onClick` handler: if `role === "guardian"`, call `toast.info("Subscribe as a User")` and return
- No other changes — guardians still see AQI badge, pollutants, temperature, and health advisory

