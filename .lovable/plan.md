# Missed check-in / missed medication WhatsApp alerts not arriving

## What the data actually shows

Verified just now in the backend:

- Both crons are alive and succeeding: `check-missed-checkins` every 10 min, `check-missed-medications` every 5 min. Latest runs 07:30 UTC today, all `succeeded`.
- Both functions boot and exit cleanly — no errors in their logs.
- Alerts *are* being processed: missed medication rows are getting stamped with `whatsapp_alerted_at` (e.g. 05:00 today, 17:00 and 09:30 yesterday).
- The ward those stamped rows belong to (`625e8bbe…`) has **no profile row at all** — so no phone, no guardians. The function stamps the rows and sends nothing, silently.
- Aldrin (`8d12aed0…`) has responded to every check-in for the last three days and taken/late-taken his medications, so no missed-alert was ever legitimately due for him.
- Nothing anywhere records whether a WhatsApp send succeeded — the code stamps first and ignores the MSG91 response.

So there are two separate problems: alerts that never had a valid recipient, and no visibility into whether the ones that do get sent are actually delivered. Whether MSG91 is additionally rejecting the guardian templates (the V2 namespace templates failed in the earlier guardian-invite diagnosis) is **not yet confirmed** — that is step 1.

## Step 1 — Confirm delivery at MSG91 (before changing template logic)

Use the existing `msg91-wa-report` diagnostic to pull the last 7 days of delivery rows for `ward_missed_check_in`, `guardian_medication_reminder`, `user_missed_checkin` and `user_missed_medication`, and send one controlled test of each template to a known-good number. Outcome decides:

- Accepted + delivered: the templates are fine, and the whole issue is "no eligible recipient" (Step 2 / Step 3).
- Rejected with a template/parameter/namespace error: fix name, language code (`en` vs `en_GB`) and namespace to match what MSG91 reports as approved.

## Step 2 — Stop losing alerts silently

In `check-missed-checkins` and `check-missed-medications`:

- Stop stamping `whatsapp_alerted_at` when the send did not happen. Record the outcome instead: only mark as alerted when MSG91 accepted the message; on failure, record the failure and let the next run retry with a bounded attempt count so a transient error is not permanent silence.
- Write one row per alert into `notification_logs` (template, recipient, MSG91 status, request id, error) exactly as the guardian-invite path already does, so "was it sent" is answerable.
- When a ward has no phone, no profile, or no accepted guardian, log that explicitly as `skipped: no recipient` rather than stamping it as alerted.

## Step 3 — Handle the orphaned ward data

`625e8bbe…` has medication logs and no profile. Decide with a query whether that account still exists in auth; if it is a deleted account, its medications/logs should be cleaned up so the cron stops manufacturing phantom missed alerts every 5 minutes.

## Step 4 — Prove it end to end

With one live ward: skip a scheduled check-in and a scheduled dose, wait out the 60-minute grace, and confirm (a) the ward's WhatsApp, (b) the guardian's WhatsApp, and (c) a `notification_logs` row with an MSG91 request id and a delivered status.

## Technical notes

- Files: `supabase/functions/check-missed-checkins/index.ts`, `supabase/functions/check-missed-medications/index.ts`, `supabase/functions/_shared/msg91Whatsapp.ts` (return the request id so it can be logged), `supabase/functions/msg91-wa-report/index.ts` (query by template name/date range).
- Possible small migration: an attempt counter / last-error column on `check_ins` and `medication_logs`, or reuse `notification_logs` alone — decided after Step 1.
- No new secrets; `MSG91_AUTH_KEY` is already set.
