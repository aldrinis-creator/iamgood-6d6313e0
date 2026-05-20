## Bereavement / Vault Claim in Guardian Settings → Wards

Brand and expose the Vault Nominee Claim flow as **"Bereavement / Vault Claim"**, placed inside `GuardianSettings.tsx` under the existing **Wards** tab, on each ward card where the guardian is Primary Guardian.

### What changes

`**src/pages/GuardianSettings.tsx**`

- Extend the wards fetch to also select `is_vault_nominee` (so we can show the correct sub-state).
- Inside each ward row in the `activeTab === "wards"` block, when `w.is_primary === true`, render a new section titled **"Bereavement / Vault Claim"** with:
  - A short, calm explainer: *"If the worst should happen, use this to begin the Vault Nominee Claim process and access {ward}'s essential records."*
  - A primary outline button **"Open Bereavement / Vault Claim"** that opens the existing `VaultClaimCard` for that ward inside a `Dialog` (so we don't navigate away from Settings).
  - A compact status line driven by `useVaultClaimStatus(w.user_id)`:
    - `loading` → "Checking eligibility…"
    - `!eligible` → muted note: *"Ward has not yet designated you as Vault Nominee. Ask them to enable this in their Vault settings."* (button disabled)
    - `eligible && !claim` → "No claim filed."
    - `eligible && claim` → badge showing claim.status (Initiated / Docs uploaded / 7-day window open / Released / Rejected / Cancelled) + relative time.
- Non-primary wards: section is hidden entirely (per your spec).

`**src/components/vault/VaultClaimCard.tsx**` — no logic changes; reused as-is inside the Dialog. Verify it accepts being mounted with a `wardUserId` prop (or whichever prop it already uses on Guardian Services) and pass the same value.

**Memory update** (`mem://features/guardian-dashboard.md`)

- Add: "Bereavement / Vault Claim is also surfaced in Guardian Settings → Wards tab, per-ward, gated on `is_primary=true`. Eligibility to actually file still requires ward's `is_vault_nominee=true` (shown as disabled state with explainer)."

### Open question (worth flagging)

You said gate it on **Primary Guardian** (`is_primary`). The existing claim RPC eligibility is gated on a separate flag `is_vault_nominee` (set by the ward in their Vault). These can differ — a Primary Guardian isn't automatically the Vault Nominee.

Two options:

- **A. Show on Primary only** (your instruction). If they're Primary but not Vault Nominee, the button is disabled with the explainer above. *(planned default)*
- **B. Show on Primary OR Vault Nominee** so a non-Primary nominee can still find it here.

I'll go with **A** unless you say otherwise. Go with A

### Out of scope

- No DB / RLS changes.
- Guardian Services tile and Guardian Dashboard slim strip stay as-is (this is an additional surface, not a move).
- No new route or bottom-nav tab.