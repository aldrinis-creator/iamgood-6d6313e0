
## Plan — Two small additions

### 1. Add a Refresh button to the AQI widget

**File:** `src/components/AQIWidget.tsx`

Add a small refresh icon button in the AQI popover header (next to the "Updated: …" timestamp on line 308–313) that re-fetches current conditions on demand.

Behavior:
- **User role:** re-runs `fetchDefaultLocation()` for the current geolocation, OR re-fetches the last searched location if `aqiData.locationName` is not "Current Location" (re-geocode via Nominatim using the cached name). Refresh does **not** consume the 5/day search quota — it only refreshes the already-loaded location.
- **Guardian role:** re-runs `fetchWardLocation()` to pull the ward's latest shared location and AQI.
- While refreshing: button shows a spinner (`Loader2`), is disabled, and the trigger pill shows the existing loading state.
- On success: `fetchedAt` updates and a subtle "Updated" toast confirms.
- On failure: toast error, previous data stays.

Icon: `RefreshCw` from lucide-react. Placement: right side of the location/timestamp row inside the popover, ghost button, `h-7 w-7`.

### 2. Let the User change their Primary Guardian

**Current state:** Today there is no user-facing way to change Primary. `OnboardingWizard` marks the first guardian added as primary, and `GuardianTab.tsx` only shows a "Primary" badge with no toggle. The only existing "Set Primary" UI is `WardEmergencyCard`, which is the **guardian's** view of a ward — not the user's own profile.

**Fix:** Add a "Set as Primary" action to the user's own guardian list.

**File:** `src/components/GuardianTab.tsx` (used inside `MyProfile` / `Settings` guardian list)

For each guardian row that is **not** currently primary AND has `status === "accepted"`:
- Add a small `Star` (outline) button next to the existing trash icon, tooltip "Set as Primary".
- Pending/expired/rejected guardians: button hidden (can't be primary until accepted).
- The current primary shows the existing filled "Primary" badge (no button needed).

Click flow:
1. Open an `AlertDialog` confirming: *"Make {name} your Primary Guardian? They will be the first contact for SOS alerts and emergency profile sharing."*
2. On confirm, run a two-step Supabase update inside a single sequence:
   - `update guardians set is_primary = false where user_id = <current user> and is_primary = true`
   - `update guardians set is_primary = true where id = <selected guardian id>`
3. On success: toast "Primary guardian updated", refresh list via existing `fetchGuardians()`.
4. On failure: toast error, no state change.

**Why no DB migration:** `guardians.is_primary` already exists; RLS already allows the user to update their own guardian rows. No new tables, functions, or policies needed.

### Verification

1. AQI popover shows a refresh icon next to the timestamp; clicking it spins, then updates the timestamp without consuming a search.
2. In My Profile → Guardians, accepted non-primary guardians show a star button. Clicking it opens a confirm dialog. Confirming flips Primary correctly and only one guardian remains Primary.
3. Existing Primary badge logic in EmergencyProfile / SOSDialog / WardEmergencyCard reads the same `is_primary` column and reflects the change immediately.

### What I will NOT change

- No DB migration, no new RLS, no new edge function.
- AQI 5/day search rate-limit logic stays intact — refresh is free.
- WardEmergencyCard guardian-side "Set Primary" flow is unchanged.
