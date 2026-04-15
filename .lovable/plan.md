## Add Per-Guardian Location Sharing Selection

### Overview

When the user enables "Share Location with Guardians" or "Live Location for Guardians", show a guardian checklist below each toggle so the user can choose which guardians receive location data. The primary guardian is pre-selected by default but can be deselected.

### Changes

**1. `src/hooks/useUserSettings.ts**`

- Add two new fields to `UserSettings`:
  - `locationSharingGuardianIds: string[]` — guardian IDs selected for location sharing
  - `liveLocationGuardianIds: string[]` — guardian IDs selected for live location
- Add defaults as empty arrays (empty = share with all, for backward compatibility)

**2. `src/pages/Settings.tsx` — PrivacyTab**

- Fetch the user's guardians (accepted status) with `id`, `guardian_name`, `is_primary`
- Below the "Share Location with Guardians" switch (line 153), when enabled, render a checklist of guardians with checkboxes
- Below the "Live Location for Guardians" switch (line 160), when enabled, render the same checklist pattern
- Primary guardian is checked by default when the list is first populated (if `locationSharingGuardianIds` is empty, auto-populate with all guardian IDs, primary first)
- Each checkbox toggle calls `updateSetting` to persist the selected IDs
- Do this change in all Settings where there is a Guardian is involved

**3. `src/hooks/useLocationSync.ts**`

- When saving location and checking safe zones, filter guardian notifications to only those whose `id` is in `settings.locationSharingGuardianIds` (if non-empty)

### Flow

```text
User enables "Share Location"
  → Guardian checklist appears below toggle
  → Primary guardian pre-checked, others unchecked
  → User selects/deselects guardians
  → Selection saved to user_settings via debounced write
  → Location sync hook respects the selection
```

### Files Modified

- `src/hooks/useUserSettings.ts` — add 2 new setting fields
- `src/pages/Settings.tsx` — add guardian checklists under location toggles
- `src/hooks/useLocationSync.ts` — filter notifications by selected guardians