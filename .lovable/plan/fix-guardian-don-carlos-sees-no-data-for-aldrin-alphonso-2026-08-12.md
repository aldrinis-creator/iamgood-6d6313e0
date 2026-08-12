# Fix: Guardian "Don Carlos" sees no data for Aldrin Alphonso

## What's actually wrong (verified in the database)

There are **two separate guardian accounts sharing the same email** `ihavecheckedin@gmail.com`:


| Account         | Name       | Phone           | Linked as Aldrin's guardian? |
| --------------- | ---------- | --------------- | ---------------------------- |
| `b56f...66fe3`  | Don Carlos | none            | No                           |
| `d914...54375e` | James Bond | +91 70458 68482 | Yes (accepted, primary)      |


Aldrin Alphonso's accepted guardian record points at the **James Bond** account. The most recent sign-in (today 04:03 UTC, email + password) was into the **Don Carlos** account, which has no ward link at all — so the guardian dashboard correctly loads zero wards and shows no data.

This is not a bug in the Guardian app code; the ward list query is doing the right thing. It is a duplicate/misrouted account issue introduced when the reviewer account was converted.

Secondary observation: every other guardian row in the system is `expired` or unlinked, so Aldrin ↔ this guardian is the only live pairing.

## Proposed fix

Pick one account to be *the* guardian account and make the app resolve to it consistently.

**Option A (recommended): consolidate onto the phone account.**

- Keep `d914...` (James Bond, +91 70458 68482) as the guardian of Aldrin — this is the account the App Store reviewer bypass OTP (`420666`) signs into.
- Rename its profile to "Don Carlos" if that is the name you want shown.
- Retire the duplicate `b56f...` account (remove its guardian role) so the email/password login can no longer land on an empty dashboard.

**Option B: consolidate onto the email account.**

- Re-point Aldrin's accepted guardian row to `b56f...` (Don Carlos) and give that profile the phone `+91 70458 68482` so OTP login also reaches it.
- Retire the `d914...` account.

Either way, both login paths (email/password and reviewer OTP) end up in the same guardian account, and Aldrin's data appears.

## Hardening (same change)

Add a guardian-side empty state: when a signed-in guardian account has zero accepted wards, the dashboard should say "No wards linked to this account yet" instead of rendering blank panels — so this failure mode is self-explanatory next time.

## Technical notes

- Ward resolution lives in `src/contexts/GuardianWardContext.tsx`: it selects `guardians` where `guardian_user_id = session.user.id AND status = 'accepted'`. No code change needed for the link itself.
- The account consolidation is a data migration on `public.guardians` (`guardian_user_id`), `public.profiles` (name/phone/role) and `public.user_roles`.
- No RLS or policy change required.

Tell me which option you want (A or B, and which display name), and I'll write the migration plus the empty-state. Option B