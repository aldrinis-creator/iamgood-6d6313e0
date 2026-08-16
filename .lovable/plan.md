# Guardian invites not sending + change Primary Guardian

## What's actually wrong (verified)

You added "Lira Alphonso" at 05:16 UTC today — the guardian row exists with a valid nomination token and 3-day expiry, but:

- No `send-guardian-invite` call appears in the function logs at that time.
- No `guardian-invitation` row appears in the email send log.

Reason: guardians added from **My Profile** are inserted straight into the database and no invite is ever dispatched. The invite code only runs on the **Settings** path. Two supporting bugs on that Settings path:

- It sends `accept_link` to `send-guardian-invite`, but the function reads `nomination_token`. So the SMS/WhatsApp invite carries a plain `/register` link with no token — the guardian can't accept from it.
- The other add paths (Onboarding wizard, unused Guardian tab) either send no token or send no invite at all.

There is also no way anywhere in the live UI to change which guardian is Primary — only the first guardian added ever gets `is_primary = true`.

## Fix

**1. One shared invite path**

Add a small helper (`src/lib/guardianInvite.ts`) that all add-guardian screens call after insert:
- insert with `.select("id, nomination_token")` so the real token is available,
- invoke `send-guardian-invite` with `nomination_token` (not `accept_link`),
- surface success/failure to the user with a toast instead of silently swallowing errors.

Wire it into My Profile, Settings, and the Onboarding wizard so all three behave identically.

**2. Harden the invite function**

In `send-guardian-invite`:
- accept `accept_link`/`nomination_token` (backwards compatible) and build the accept/reject links from whichever is present,
- return a per-channel result (`{ email: sent|failed|skipped, sms: ... }`) so the UI can say "Invite sent by email and SMS" or warn when a channel failed,
- keep the existing 1-hour re-send rate limit.

**3. Resend for pending invites**

My Profile guardian rows get the same "Resend invite" action Settings already has, shown for `pending`/`expired` guardians.

**4. Change Primary Guardian**

Add a "Make Primary" action on each non-primary **accepted or pending** guardian in both My Profile and Settings:
- confirmation dialog ("Make Lira your Primary Guardian? Aldi will become a secondary guardian."),
- clears `is_primary` on the current primary, sets it on the chosen one,
- ward-side RLS already permits this update, so no database change is needed.

## Notes

- WhatsApp/SMS invite uses the existing MSG91 flow template (`MSG91_INVITE_TEMPLATE_ID`); the email uses the existing branded `guardian-invitation` template. No new templates or secrets.
- I'll re-send the Lira invite once the fix is in, so she gets a working accept link.
- No schema or RLS changes.
