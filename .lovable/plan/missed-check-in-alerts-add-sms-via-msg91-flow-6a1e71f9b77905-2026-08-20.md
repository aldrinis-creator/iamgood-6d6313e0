# Missed check-in alerts: add SMS via MSG91 Flow `6a1e71f9b779054ff40a5e93`

## What is confirmed

- Template ID `6a1e71f9b779054ff40a5e93` is an **SMS Flow** template, not a WhatsApp one: `control.msg91.com/api/v5/flow/6a1e71f9b779054ff40a5e93` returns `type: success`, while both WhatsApp template endpoints return "Route Missing".
- Both alert crons are alive and succeeding (`check-missed-checkins` every 10 min, `check-missed-medications` every 5 min; latest runs today, all `succeeded`) and both functions boot and exit without errors.
- Missed medication rows are being stamped `whatsapp_alerted_at` (05:00 today, 17:00 and 09:30 yesterday), but they belong to a ward (`625e8bbe…`) that has **no profile row** — no phone, no guardians — so nothing was ever sent for them.
- Aldrin (`8d12aed0…`) responded to every check-in for the last three days and took every dose, so no missed-alert was legitimately due for him. His one accepted guardian is James Bond (+91 70458 68482).
- Nothing records whether a WhatsApp/SMS send succeeded — the code stamps first and ignores the MSG91 response, so failures are invisible.

## Step 1 — Live test of the flow

Send one SMS through the existing `msg91-send` function to **+91 98195 76467** with `template_id: 6a1e71f9b779054ff40a5e93` and the ward name "Aldrin". The exact DLT variable key is not yet known, so the test sends the value under the common Flow key shapes (`VAR1` / `var1` / named key) one at a time until MSG91 accepts and the SMS lands, then locks that key in.

## Step 2 — Wire it into missed check-in alerts

In `check-missed-checkins`, alongside the existing WhatsApp `ward_missed_check_in` message to guardians:

- Send this SMS flow to every accepted guardian of the ward, with the confirmed variable(s) (ward name, and the missed slot time if the DLT text has a second variable).
- SMS is sent as a **fallback**, only when the WhatsApp send did not come back accepted, so guardians do not get duplicate alerts. If the flow text is meant to always accompany WhatsApp, that switches to always-send — decided after Step 1 shows the actual message body.

## Step 3 — Stop losing alerts silently

- Only stamp `whatsapp_alerted_at` once a channel actually accepted the message; on total failure, leave it for the next run with a bounded attempt count so one bad response is not permanent silence.
- Log every attempt into `notification_logs` (channel, template, recipient, MSG91 status, request id, error) the way the guardian-invite path already does.
- Log "skipped: no recipient" explicitly when a ward has no phone/profile or no accepted guardian, instead of stamping it as alerted.

## Step 4 — Clean up the phantom ward

`625e8bbe…` has medication rows but no profile. Confirm whether the auth account still exists; if it is deleted, remove its medications/logs so the cron stops manufacturing missed alerts that can never be delivered.

## Technical notes

- Files: `supabase/functions/check-missed-checkins/index.ts` (SMS fallback + outcome logging), `supabase/functions/_shared/msg91Whatsapp.ts` (return request id), possibly a small shared `msg91Sms.ts` helper wrapping the Flow API, `supabase/functions/check-missed-medications/index.ts` (same logging fix).
- New secret `MSG91_MISSED_CHECKIN_TEMPLATE_ID` holding `6a1e71f9b779054ff40a5e93`, so the ID is not hard-coded.
- Optional small migration for an attempt counter / last-error column on `check_ins` and `medication_logs`; may be unnecessary if `notification_logs` alone is enough.
