## Goal

When a check-in or medication is missed and remains unresolved 1 hour past the scheduled time, fire **exactly one** WhatsApp message to the user and **one** to each accepted guardian. No further reminders. Email + web-push to guardians keep working as today.

## New WhatsApp helper

Create `supabase/functions/_shared/msg91Whatsapp.ts` exporting `sendWhatsAppTemplate({ templateName, languageCode, recipients })` that POSTs to:

```
https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/
```

with the documented payload shape (`integrated_number`, `namespace`, `template.name`, `language.code/policy=deterministic`, `to_and_components[].components.body_1/body_2`). Constants:

- `integrated_number`: `"917045868482"`
- `namespace`: `"e1e205a8_3b76_4c20_bde4_9f124a35c8c4"`
- `authkey`: `Deno.env.get("MSG91_AUTH_KEY")` (already configured)

Phone normalization reuses the existing `91` prefix logic.

### Template → variable mapping (locked)

| Template | Lang | body_1 | body_2 |
|---|---|---|---|
| `user_missed_checkin` | en_GB | scheduled time (`7:00 AM`) | — |
| `guardian_missed_checkin` | en_US | ward full name | scheduled time |
| `user_missed_medication` | en_US | medication name(s), comma-joined | — |
| `guardian_missed_medication` | en_US | ward full name | medication name(s), comma-joined |

## Check-ins — `supabase/functions/check-missed-checkins/index.ts`

Pre-existing logic already runs after a 1-hour grace, marks each slot `missed` exactly once, dedupes per user+hour, and skips guardian/paused users. Add, inside the per-checkIn block where `guardians` are loaded:

1. Look up user's WhatsApp number from `profiles.phone` for `checkIn.user_id`.
2. Send `user_missed_checkin` once with `body_1 = timeStr`.
3. Send `guardian_missed_checkin` once to all accepted guardian phones in a single bulk call (one `to_and_components` entry per guardian, each with `body_1 = userName`, `body_2 = timeStr`).
4. Keep the existing email + web-push fan-out untouched.

No new dedup table needed — the `status: pending → missed` transition (already guarded by `.eq("status","pending")` on update) is the single-fire gate.

## Medications — `supabase/functions/check-missed-medications/index.ts` (new)

There is currently no cron that batches missed meds at T+60m — `notify-guardian-medication` only fires from the client when the user dismisses/marks-skipped, and `send-consolidated-alerts` was the only T+ batch path. We create a dedicated cron-driven function modeled on `check-missed-checkins`:

- Query `medication_logs` where `status = 'missed'` AND `scheduled_at` between IST-today-start and `now - 60min` AND no WhatsApp-sent marker yet.
- Also pick up `pending`/no-log medications whose scheduled time is >60 min in the past by reconciling against `medications` schedules (same approach the client uses today). Simpler v1: rely on `medication_logs` rows with `status='missed'` (these are already written by client adherence flow and `notify-guardian-medication`).
- **Group by `user_id` + same scheduled hour** → one WhatsApp send covering all meds in that hour. Join names with `, `.
- Exclude guardian-role users and paused (`checked-out` / sleep) users — same helpers as check-ins function.
- Per group:
  1. Send `user_missed_medication` to `profiles.phone` with `body_1 = "Crocin, Metformin"`.
  2. Send `guardian_missed_medication` bulk to all accepted guardians with `body_1 = userName`, `body_2 = med names`.
  3. Insert deduped in-app notifications via `insert_notifications_deduped` (already used elsewhere) so guardian dashboard still shows the event.
  4. Keep email/push paths consistent with existing `notify-guardian-medication` behavior (reuse `send-transactional-email` template `missed-medication-alert` if it exists, otherwise skip — out of scope to add a new email template here).

Single-fire guarantee: add a `whatsapp_alerted_at timestamptz` column to `medication_logs` via migration; the function selects only rows where it is null and stamps it before sending. (No equivalent column needed for check-ins because the `pending→missed` flip already gates it.)

### Migration

```sql
ALTER TABLE public.medication_logs
  ADD COLUMN IF NOT EXISTS whatsapp_alerted_at timestamptz;
```

No new GRANTs/policies — column inherits existing table grants.

### Cron

Add a 5-minute pg_cron entry (via `supabase--insert`, not migration, since it embeds the project URL + anon key) calling the new `check-missed-medications` function. Keep the existing `check-missed-checkins` cron unchanged.

## `send-consolidated-alerts` (4-hour SMS batch)

Gut the function body to a no-op that returns `{ disabled: true }`. Leave the existing pg_cron entry in place so it can be re-enabled later by restoring code. No MSG91 calls inside.

## `notify-guardian-medication`

This function fires from the client at the moment a med is marked missed (within the 65-min window). Remove its MSG91 SMS block (the `MSG91_MED_TEMPLATE_ID` Flow call) so the only WhatsApp message users/guardians get is the single one from the new T+60m cron. Keep its in-app notification + push logic — those are the immediate UI signals.

## Config

`supabase/config.toml` — add:
```
[functions.check-missed-medications]
  verify_jwt = false
```

## Out of scope

- No new secrets (uses existing `MSG91_AUTH_KEY`; integrated number + namespace are hard-coded constants matching your curl examples).
- No schema changes beyond the one `whatsapp_alerted_at` column.
- No UI changes.
- No changes to OTP/SOS/invite/appointment WhatsApp flows.
- No changes to email templates.

## Verification

1. Deploy functions; confirm `supabase--edge_function_logs` shows the new WhatsApp POSTs with HTTP 200 from MSG91.
2. Query `check_ins` / `medication_logs` to confirm each missed slot gets exactly one send (status flip / `whatsapp_alerted_at` set).
3. Confirm `send-consolidated-alerts` invocations return `{ disabled: true }` and make zero outbound calls.
