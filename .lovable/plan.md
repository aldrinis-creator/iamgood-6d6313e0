# Guardian invite: app download link, acceptance confirmation, reminder escalation

## What's happening now (verified)

Lira Alphonso was nominated today at 05:53 UTC and an invite **was** dispatched, but only partly:

- WhatsApp/SMS: sent
- Email: **failed** — nothing reached the email send log at all, so the invite email never left the system

Also confirmed:

- Neither the invite email nor the WhatsApp message carries a real **download/install link** — the email only has written "add to home screen" instructions, and the link in both is the `/register?nomination=accept&token=...` accept link.
- When a guardian **accepts**, nothing is sent back to the ward. Only rejection creates a notification.
- There is **no reminder job** for pending nominations. The only scheduled job is `expire-stale-nominations`, which silently flips them to `expired` after 3 days without telling the ward.

## What will change

**1. Fix the failing invite email**
Capture and log the real failure from the email send call inside `send-guardian-invite` (currently swallowed into `failed`), and retry the send. Verify by re-sending Lira's invite and confirming a `guardian-invitation` row appears in the email log.

**2. Add a real download link to every invite**
Invite email and WhatsApp/SMS get a clear "Install the Guardian app" link pointing at `/install?g=<token>`. The install page detects the guardian context and shows: install first, then accept. The accept link stays as-is alongside it.

**3. Tell the ward when the guardian is on board**
Two confirmations to the ward:
- Guardian accepted the nomination — in-app notification + WhatsApp.
- Guardian actually opened/installed the app (first sign-in of the linked guardian account) — in-app notification: "Lira has installed the Guardian app and is now connected."

**4. Reminders, then tell the ward**
A daily scheduled job scans pending nominations and sends up to **3 reminders** (24h, 48h, 72h after nomination) to the guardian by WhatsApp and email. After the 3rd reminder goes unanswered, the ward gets an in-app notification + WhatsApp: "Lira has not yet accepted your guardian invite after 3 reminders — you may want to call them or nominate someone else." The nomination expiry window extends to match the reminder schedule so it does not expire before the last reminder.

## Technical notes

- New columns on `guardians`: `reminder_count`, `last_reminder_at`, `ward_notified_unaccepted` (migration with grants; existing RLS unchanged).
- New edge function `guardian-invite-reminders` + pg_cron daily at 10:00 IST.
- `guardian-nomination-response` gains a ward-notification step on accept.
- Install-confirmation fires from the existing guardian-account linking path (`link_guardian_user_id`) on first guardian sign-in.
- Reuses the existing MSG91 flow templates and the branded `guardian-invitation` email template; a short `guardian-reminder` variant is added to the template registry.
- No new secrets.

## Open item

Reminder cadence is proposed as day 1 / day 2 / day 3. Say the word if you'd prefer a different spacing (e.g. 6h / 24h / 72h).
