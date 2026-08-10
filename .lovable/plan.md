# Make +91 70458 68482 a Guardian review account

Same login as before: no SMS is sent, fixed code `420666`. Only the account's role and its link to the senior account change.

## Current state (verified)

- `+91 70458 68482` currently belongs to a **user**-role account named "James Bond".
- Aldrin's accepted primary guardian record already carries the phone `+91 70458 68482`, but it is linked to a different account ("Don Carlos", which has **no phone at all**, so it can never be reached by OTP login).
- Result today: a reviewer typing that number signs in as James Bond and sees the senior's app, not the guardian dashboard.

## What changes

1. **Convert the account to a guardian**
   - Set its role to `guardian` (both on the profile and in the roles table).
2. **Link it to the senior account (Aldrin) as the accepted primary guardian**
   - Point the existing accepted guardian record at this account instead of the phoneless "Don Carlos" account, keeping primary and vault-nominee status intact. Nothing about the senior's data changes.
3. **Leave the reviewer bypass untouched**
   - Both numbers stay in `REVIEW_PHONES`, code stays `420666`, and the 30-day premium grant continues to apply to whichever account signs in.

Outcome for the reviewer: `+91 98195 76467` = senior view, `+91 70458 68482` = guardian view of the same senior, both with `420666`.

## The two remaining warn-level findings

**1. Plaintext OTP column (`otp_events.otp_code`)**
The scanner flags that a column literally named `otp_code` exists on a table and could hold a usable login code. As of the last fix, codes are stored only as SHA-256 hashes, the hash is nulled the moment it is verified, and a check just now shows **zero** rows holding any code at all. Only the backend service role can read the table — no user, signed in or not, has access. So the practical risk is gone; the warning persists because the column name and shape still look like OTP storage. Closing it properly means either renaming the column to `otp_hash` (a small migration plus one edge-function change) or marking the finding as accepted with a note.

**2. Vault-claim read scope**
This one flags that guardians can read rows in the vault-claim table. Reviewing the live rules: a guardian can only see a claim where they are the *accepted* guardian of that specific senior **and** are flagged as that senior's vault nominee — i.e. only their own claim. The senior can see their own claim, admins can see all. That is the intended design for the inheritance flow, so this is best recorded as an accepted risk rather than "fixed".

Say the word and I will do either: rename the OTP column and mark both findings resolved/accepted with the reasoning written into security memory.
