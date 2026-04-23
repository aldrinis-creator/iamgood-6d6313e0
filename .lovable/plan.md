

## Plan — Surface auto-rejection reasons from `vault-claim-initiated` to the UI

The existing edge function (`supabase/functions/vault-claim-initiated/index.ts`) **already enforces every block you asked about**:
- Iterates the 3 expected files (`death_certificate_url`, `id_proof_url`, `selfie_url`) and rejects with `"Missing required file: <key>"` if any path is null.
- Calls `storage.from("medical-documents").list(folder)` and rejects with `"File missing or empty: <key>"` if the object is absent or `metadata.size <= 0`.
- Cross-checks user's `last_sign_in_at` (auto-reject "user_active_24h") and `date_of_birth` vs `date_of_death` ("dod_before_dob").
- Writes the reason into `vault_nominee_claims.reject_reason` and flips `status='rejected'`.

The DB-level state machine (`enforce_vault_claim_status_transition`) and the `vault_one_active_claim_per_user` partial unique index also block any tampering at the SQL layer.

**The actual gap** is on the client: `VaultClaimCard.submitClaim()` invokes the edge function and immediately shows `toast.success("Claim filed…")` regardless of the response. If the function auto-rejects, the user sees a misleading success and has no idea why the claim is gone.

### A. Edge function — return structured reject payload (`vault-claim-initiated/index.ts`)

Tighten the existing responses so the client can branch on them:
- On every `rejectClaim()` path, return `{ ok: false, rejected: true, reason_code, reason_message }` with HTTP 200 (so the function call doesn't throw on the client; we want the body, not an exception). Reason codes:
  - `missing_file` (`death_certificate` | `id_proof` | `selfie`)
  - `file_empty` (same keys)
  - `user_active_24h`
  - `dod_before_dob`
  - `claim_not_found`
- On success: `{ ok: true, status: "user_window_open", window_ends_at }`.

### B. Client — read the response and surface the reason (`src/components/vault/VaultClaimCard.tsx`)

In `submitClaim()`, replace the fire-and-forget invoke with:

```ts
const { data: result, error: invokeErr } = await supabase.functions.invoke(
  "vault-claim-initiated",
  { body: { claim_id: claimId } }
);
if (invokeErr) throw new Error("Server verification failed — please try again");

if (result?.rejected) {
  const reasonMap: Record<string, string> = {
    missing_file: "A required document is missing. Please re-upload all three files.",
    file_empty:   "One of the uploaded files is empty or corrupted. Re-upload and try again.",
    user_active_24h: "This claim was auto-rejected because the account was active in the last 24 hours.",
    dod_before_dob:  "Date of death cannot be before the user's date of birth. Please correct and refile.",
    claim_not_found: "Claim record was lost. Please try again.",
  };
  toast.error(reasonMap[result.reason_code] || result.reason_message || "Claim auto-rejected.");
  // Refresh local claim state so the card shows "Rejected" badge
  const { data: refreshed } = await supabase
    .from("vault_nominee_claims" as any)
    .select("id, status, user_window_ends_at, created_at")
    .eq("id", claimId).maybeSingle();
  setClaim(refreshed as any);
  setOpen(false);
  resetWizard();
  return;  // do NOT show success
}

toast.success("Claim filed. The user has 7 days to cancel before admin review.");
```

Also: after the success branch, fetch the row back instead of optimistically hard-coding `status: "user_window_open"` — that way if the trigger ever changes the timestamp logic, the UI stays accurate.

### C. Show the rejection reason on the card itself

Extend the card's status block so when `claim.status === "rejected"`, render the `reject_reason` underneath the badge in small destructive text, and replace the disabled state with an "Acknowledge & dismiss" button that simply hides the row locally (`setClaim(null)`) so the guardian can refile after the 30-day rate-limit window. Add `reject_reason` to the existing `select(...)` calls (two places: initial load and post-submit refresh).

### D. Verification

1. Manually delete one of the uploaded files in Storage right after submit (race) → next claim attempt returns `reason_code: "file_empty"` → red toast appears with the exact message, card shows "Rejected" badge + reason.
2. Sign in as the deceased ward, then within 24 h have the guardian file → toast: *"This claim was auto-rejected because the account was active in the last 24 hours."*
3. Enter a `date_of_death` earlier than the ward's DOB (bypass step-2 validation via devtools) → server rejects with `dod_before_dob` → red toast + status badge updates.
4. Happy path: all three valid files, DOD valid, user inactive → success toast, badge shows "Grace Window (7 days)".
5. No DB or function-level behaviour change — only response shape and client handling. PIN escrow, admin release, and OTP portal untouched.

### What I will NOT change

- DB triggers, RLS, or rate-limit logic (already enforce everything end-to-end).
- Storage bucket policies.
- `vault-release-claim`, `vault-claim-otp-verify`, `vault-cancel-claim`.
- The 5-step wizard UI itself — only the post-submit response handling.

