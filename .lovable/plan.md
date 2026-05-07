## Move Vault Nominee Access from Dashboard to Guardian Services

Stop the "Report Bereavement & Claim Vault" card from confronting guardians on every dashboard load. Relocate it to Services where nominee actions logically belong, and surface a slim status strip on the dashboard only when there's an active claim.

### 1. `src/pages/GuardianDashboard.tsx`
- Remove the `<VaultClaimCard />` render (~line 720) from the main dashboard layout.
- Add a lightweight inline status strip that renders **only when** the eligibility check returns an in-flight claim (`pending`, `under_review`, `released`, or `rejected`). Copy: e.g. "Vault claim under review — tap to view". Tapping navigates to `/services` (or opens the claim card directly). No claim → nothing renders, zero visual footprint.
- Reuse the same eligibility/claim-status query already inside `VaultClaimCard` — lift it into a tiny shared hook (`useVaultClaimStatus`) in `src/components/vault/` so both Dashboard strip and Services tile read from the same source.

### 2. `src/pages/GuardianServices.tsx`
- Add a new "Available" service tile **only when `eligible === true`** (i.e., the guardian is actually a nominee on at least one ward's vault):
  - Icon: `ShieldCheck` (lucide), neutral primary tint — no destructive red.
  - Title: "Vault Nominee Access"
  - Subtitle: "Available if the worst should happen."
  - Action: opens `<VaultClaimCard />` inline below the tile (same pattern as `AmbulanceBooking` toggle), or routes to a dedicated section.
- If `eligible === false`, the tile is not rendered at all — keeps Services clean for non-nominees.

### 3. `src/components/vault/VaultClaimCard.tsx`
- Soften the resting (pre-action) visuals:
  - Replace destructive red border/background with neutral card styling.
  - Change resting copy from "Report Bereavement & Claim Vault" to something calmer like "Initiate Vault Claim" with a short explainer.
  - Keep the wizard's destructive treatment (red confirm button, AlertDialog confirmations) intact — only the entry point gets softened.

### Out of scope
- No changes to the claim wizard flow, OTP verification, RPC calls, or `vault_claim_*` edge functions.
- No changes to `VaultNomineeRecoveryDialog` or `VaultClaimCancelBanner`.
- No DB migrations.

### Verification
1. Guardian with no nominee role → Services shows no Vault tile; Dashboard shows nothing.
2. Guardian who is a nominee, no active claim → Services shows the calm Vault tile; Dashboard shows nothing.
3. Guardian initiates a claim → Dashboard now shows the slim "claim under review" strip; tapping it opens the claim card.
4. Claim resolved/cancelled → strip disappears from Dashboard.

### Memory updates after implementation
- Update `mem://features/guardian-dashboard.md` to remove `VaultClaimCard` from the dashboard layout list and note the conditional status strip.
- Add a note to vault feature memory that nominee access lives in Guardian Services.
