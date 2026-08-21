# Fix: Guardian invites land people in the User app

## What the investigation found

Aldrin's two invites (Lira Alphonso, Steve Vaz) were both dispatched correctly — WhatsApp and email went out with a valid nomination token, and the link carried `/install?g=<token>`. Verified in the invite logs (`has_token: true`, MSG91 accepted both).

The breakage is after the tap, not in the sending:

1. The installed app always starts at `/` (the PWA `start_url`). The `?g=<token>` is lost the moment the app is installed and reopened from the home screen, so the guardian lands on the normal User home/sign-up and creates (or is offered) a **User** account.
2. The `/install` page leads with "Install Now" / "Add to Home Screen"; accepting the nomination is a secondary card below it. Most people install first, reopen from the home icon, and never come back to the tokened link.
3. Two other invite paths send an invite with **no** token at all, so their links point at the plain User install/registration pages:
   - "Re-send invite" in the Guardian tab component omits `nomination_token`.
   - The registration-time invite sends an extra email whose accept button is the bare `/register` (User sign-up).

Database confirms the outcome: both guardian rows have **no linked guardian account** (`guardian_user_id` is empty), and Lira's nomination has since expired.

## The fix

**1. Never lose the token**
- On any page load with `?g=` or `?nomination=accept&token=`, stash the token locally (with an expiry).
- On app start at `/`, if a pending guardian token exists and there is no signed-in guardian, route straight to the guardian accept flow instead of the User home.
- Clear the stash once the nomination is accepted, rejected, or expired.

**2. Make `/install?g=` a Guardian-first page**
- Reorder so "Accept & create your Guardian account" is Step 1 and the install instructions are Step 2.
- Guardian-specific heading, ward name, and copy stating this is the Guardian side of Check-iN — no generic User install pitch when a token is present.

**3. Close the tokenless invite paths**
- Guardian tab "Re-send invite": fetch and pass the live `nomination_token`, same as the profile/settings path.
- Registration-time invite: drop the duplicate tokenless email and let `send-guardian-invite` (which has the token) send the single correct invite.

**4. Recover the two affected guardians**
- Reset Lira's expired nomination and re-issue fresh invites to both Lira and Steve so they get working Guardian links.
- Clean up the duplicate Steve row so he isn't nominated twice.

## Technical notes

- New helper (e.g. `src/lib/pendingNomination.ts`) for stash/read/clear of the token in `localStorage` with a 7-day TTL.
- Root redirect handled in the existing index route / `AppLayout` auth gate, before the User dashboard renders.
- `src/pages/Install.tsx`: reorder sections, guardian-aware copy.
- `src/components/GuardianTab.tsx`: reuse `resendGuardianInvite` from `src/lib/guardianInvite.ts`.
- `src/pages/Register.tsx`: remove the `guardian-invitation` email call that passes `acceptLink: /register`.
- No schema changes; recovery is a data update plus edge-function invocations for the two invites.
