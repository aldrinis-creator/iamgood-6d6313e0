# Guardian dashboard + ward records: recommendation

## Short answer: no, this doesn't need building

The guardian side already exists and is routed:

- `/guardian` (dashboard), `/guardian/alerts`, `/guardian/reports`, `/guardian/services`, `/guardian/messages`, `/guardian/appointments`, `/guardian-settings`, `/guardian-help`.
- `GuardianReports` already reads the ward's medications, medication logs, check-ins, activity and vitals, meals, journey reports and **medical records**.
- Guardian-side components already cover the hospital kit, hospital visit and analysis report tabs.

## And the Secure Vault should stay out of it

The Data Vault entries (`encrypted_documents`) are encrypted client-side with the ward's PIN. Guardians can only ever reach them through the existing nominee claim flow (`vault_nominee_claims`, proof upload, 7-day ward objection window, admin review, one-time release token). Exposing vault contents on the guardian dashboard would mean weakening or escrowing that PIN for everyday viewing — that removes the core privacy guarantee and I'd advise against it.

## What I'd do instead (small, optional)

If anything is worth doing here, it's a light pass — not a rebuild:

1. Confirm on the running app that a linked guardian actually sees the ward's medical records tab populated (Namta/Aldrin are now linked, so this is testable end to end).
2. If records show empty due to access rules rather than missing data, fix that read path only.
3. Leave the Secure Vault untouched; if a ward wants a guardian to hold vault access, that stays the nominee route.

Nothing is built until you say which of these you want; approving this plan means I run step 1 (a read-only check) and report back.
