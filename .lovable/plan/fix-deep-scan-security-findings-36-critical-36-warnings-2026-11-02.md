# Fix deep-scan security findings (36 critical, 36 warnings)

Work in five batches, most dangerous first. Each batch is deployed and checked before the next. Everyday features (check-ins, SOS, reminders, weekly reports, guardian invites) keep working; only strangers lose access.

## Batch 1 — Account takeover (do first)
- Admin sign-up: block creating new or first administrator accounts from outside; only existing admins can add one.
- Self-promotion to admin: stop users changing their own role (profile role and role table), server-side only.
- App Store review bypass in sign-in: limit it to the single review phone number with a secret code, no other accounts.
- Email-by-phone lookup: no longer open to anonymous callers.
- Admin 2-factor and vault release codes: add attempt limits so codes can't be guessed.
- Coupon admin: only accept known fields.

## Batch 2 — Messages sent to anyone, in the app's name
Require a signed-in user and check recipients are that person's real accepted guardians (or a known pharmacy/address) for: safe-zone exit/return alerts, general message sender, SOS alert email recipients, pharmacy orders, ambulance requests (only your own or your ward's health data), guardian invites, transactional email queue, delivery-report and template lookups.

## Batch 3 — Scheduled jobs that strangers can start
Missed check-ins, missed medications, weekly reports (email and WhatsApp), invite reminders, nomination expiry, OTP cleanup, email health check: accept only the scheduler's secret key (or an admin). Remove the test-db function. SOS delivery updates: verify the provider's signature.

## Batch 4 — Paid services used for free
Card scanning, speech-to-text, prescription reading, help assistant, premium health tools: require sign-in, and premium tools check the plan on the server. Voice and help assistants: ignore caller-supplied system instructions.

## Batch 5 — Printouts and logs
- Emergency cards, SOS card, medication orders, analysis report, profile print: escape names and text so nothing typed can run as code.
- Spreadsheet exports (contacts, waitlist): neutralise formulas.
- Medicine/store search: safe query building.
- Remove phone numbers, emails, tokens and health questions/answers from logs.

## Checks
- After each batch: code check, deploy, call each function without sign-in (must be refused) and with a real signed-in session (must work). Scheduled jobs confirmed on their next run.
- Fresh quick and deep scans at the end; mark fixed findings.

## Technical notes
- Scheduler auth via a shared CRON secret header set in the existing pg_cron jobs.
- Role guard: trigger on user_roles/profiles allowing changes only via service role or has_role(admin).
- HTML escaping via one shared helper used by every print window.
