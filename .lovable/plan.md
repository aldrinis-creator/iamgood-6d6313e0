

# Make Medical Vault Accessible

## What We'll Do
Add Medical Vault access in two places:
1. **My Health tools grid** — Add a "Vault" card with a Shield/Lock icon as the 10th tool
2. **Profile dropdown** (AppHeader) — Add a "Medical Vault" menu item between "My Profile" and "Settings"

## Changes

### 1. `src/pages/MyHealth.tsx`
- Add a new entry to `healthTools` array: `{ icon: ShieldCheck, label: "Vault", color: "bg-sos/10 text-sos" }`
- Add to `toolComponents`: map "Vault" to navigate to `/medical-vault` (since it's a full page, not an inline component)
- Handle the special case: when "Vault" is clicked, navigate to `/medical-vault` instead of rendering inline

### 2. `src/components/AppHeader.tsx`
- Add a `DropdownMenuItem` for "Medical Vault" linking to `/medical-vault`
- Place it after "My Profile" in the dropdown menu

No database or routing changes needed — the `/medical-vault` route already exists in `App.tsx`.

