# Secure Vault: two-tile restructure

The vault page currently shows five top-level tabs (Records · Visual · Dr Report · Profile · Vault) and, inside the Vault tab, a horizontally scrolling strip of seven categories. Investments and Social Media were added to that strip but sit off-screen to the right, so they read as "missing". Restructuring the page fixes the visibility problem and the clutter at the same time.

## New structure

```text
Secure Vault
├── Medical Vault  (tile)
│     ├── Records
│     └── Dr. Reports
└── Data Vault  (tile)
      ├── Identity Docs
      ├── Email Accounts
      ├── Bank Accounts
      ├── Insurance
      ├── Legal Will
      ├── Investments
      └── Social Media
```

1. Page heading renamed from "Medical Vault" to "Secure Vault".
2. The tab strip is removed. Landing view shows two large tiles: Medical Vault and Data Vault.
3. Tapping a tile opens a vertical list of sub-tiles (same card-row pattern as My Health hubs), with a back arrow to the tile grid.
4. Visual and Profile tabs are removed from the header as requested. The Visual Check records still live under Records (they are records of type "Visual Check", filterable there), so nothing is lost.
5. Data Vault sub-tiles stay behind the existing 6-digit PIN unlock; the PIN prompt appears once when Data Vault is opened, and each sub-tile then opens that category's add/list view directly — no more horizontal scrolling, so all seven are always visible.

## Technical notes

- `src/pages/MedicalVault.tsx`: replace `Tabs`/`TabsList`/`TabsContent` with local `section` state (`null | "medical" | "data"`) plus `subview` state. Keep the existing Records and Doctor Report JSX bodies intact, just render them from the new navigation instead of tab panels. Delete the `visual` and `profile` panels and the now-unused profile fetch state (`fetchProfileView`, `profileView`, `profileMeds`, `profileGuardians`, `profileLoading`) and their imports; keep the 30s idle auto-lock, keyed to the new section state instead of `activeTab`. Header title and `VaultGate title` become "Secure Vault".
- `src/components/vault/VaultCategorisedSection.tsx`: accept an optional `category?: VaultCategory` prop. When provided, skip the horizontal tab strip and render only that category's list plus its add/edit dialog; when absent, behaviour is unchanged. Ordering of `VAULT_CATEGORIES` in `src/lib/vaultCategories.ts` is reordered to match the list above (Investments and Social Media after Legal Will).
- No database or encryption changes. Existing entries in every category continue to decrypt exactly as before.
