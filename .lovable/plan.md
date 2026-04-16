

## Add Emergency First Aid Tile + Remove Vault from My Profile

### Overview
1. Add "Emergency First Aid" as a top-level tile on the My Health grid (alongside Tablets, Activity, Vitals, etc.)
2. Remove the Medical Vault link from the My Profile page header menu — keep it only accessible via My Health

### Changes

**1. `src/pages/MyHealth.tsx`**
- Add `ShieldAlert` icon import (already imported)
- Add a new entry to `healthTools` array: `{ icon: ShieldAlert, label: "Emergency First Aid", color: "bg-destructive/10 text-destructive" }`
- Add `"Emergency First Aid": EmergencyFirstAid` to `toolComponents` map so it opens directly from the tile (not through Health Tools sub-menu)
- Keep the existing sub-item inside Health Tools as well for discoverability

**2. `src/components/AppHeader.tsx`**
- Remove the "Medical Vault" `DropdownMenuItem` (lines 48-52) from the user menu
- Remove the `ShieldCheck` icon import since it's no longer used

### Files
| File | Action |
|------|--------|
| `src/pages/MyHealth.tsx` | Add Emergency First Aid to top-level grid + toolComponents |
| `src/components/AppHeader.tsx` | Remove Medical Vault menu item |

