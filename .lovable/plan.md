# Stop the "for User" alerts reaching Steve Vaz (+91 98216 22152)

## What the data shows

Steve exists twice in the backend:

1. `Steve Vaz` — role **guardian**, phone `+919821622152`. This is his real Guardian account (guardian of Aldrin, accepted). No check-ins, no medications — correct.
2. A second `Steve Vaz` account — role **user**, **no phone**, created 21 Aug. It has 12 check-in rows, 8 notifications, and its own guardian list containing `+91 9821622152` (Steve's own number) plus a pending nomination for Aldrin.

So the missed check-in cron treats account 2 as a ward, marks its slots missed, and WhatsApps "its guardian" — which is Steve himself. Confirmed in `notification_logs`: at 14:30 today two separate `ward_missed_check_in` sends went out — one for Aldrin's ward (recipients include Steve, correct) and one for the phantom Steve-as-ward account with recipients `[919821622152]` only (wrong). Same pairing at 07:30, 02:30, and on 23 Aug, plus `guardian_medication_reminder` sends.

The earlier clean-up of Steve's stray check-in rows did not hold because the account still carries the `user` role, so the cron regenerates rows every day.

## Fix

1. **Retire the phantom ward account** — remove its `user` role, give it the `guardian` role (it is Steve's duplicate sign-up), delete its check-in rows, its own guardian nominations, and its notifications so nothing regenerates.
2. **Make the cron immune to this class of account** — in `check-missed-checkins` (and the same guard in `check-missed-medications` / `send-checkin-push`), skip any ward that has no phone on its profile or that holds the `guardian` role, and never pre-create check-ins for such accounts. A ward with no phone can never be alerted about anyway.
3. **Block self-nomination** — reject saving a guardian whose phone equals the ward's own phone, so an account can no longer be its own guardian.

## What Steve will see afterwards

Only alerts about Aldrin (his actual ward). No more duplicate missed-check-in or medication WhatsApps about "himself".

## Technical notes

- Data clean-up via migration/SQL: `user_roles` row swap for the duplicate account, `delete from check_ins / guardians / notifications` for that `user_id`.
- Code: `supabase/functions/check-missed-checkins/index.ts` (ward eligibility filter at the pre-population step and the alert step), `supabase/functions/check-missed-medications/index.ts`, `supabase/functions/send-checkin-push/index.ts`.
- Self-nomination guard in the guardian add path (`src/components/.../GuardianTab` + `guardians` insert validation).
- No change to the WhatsApp templates.
