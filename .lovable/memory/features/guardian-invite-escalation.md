---
name: Guardian invite escalation
description: Install-first invite links, acceptance/install confirmations to the ward, and 3-reminder escalation for pending guardian nominations
type: feature
---

- Invite links point at `/install?g=<nomination_token>` (install first, then accept). Accept/reject links remain `/register?nomination=accept|reject&token=...`.
- `send-guardian-invite` calls `send-transactional-email` over plain HTTP with the service-role bearer (NOT `functions.invoke` — that path silently failed) and accepts an `x-cron-secret` header for server-side calls.
- Nominations now expire after 4 days so all three reminders land first.
- `guardian-invite-reminders` edge function + pg_cron `guardian-invite-reminders-daily` (10:00 IST) sends up to 3 daily reminders; after the 3rd, the ward gets a `nomination_unaccepted` notification once (`ward_notified_unaccepted` flag).
- Ward confirmations: `nomination_accepted` notification on accept, and `guardian_installed` when `link_guardian_user_id()` first links the guardian's account (sets `install_confirmed_at`).
- Tracking columns on `guardians`: `reminder_count`, `last_reminder_at`, `ward_notified_unaccepted`, `install_confirmed_at`.
