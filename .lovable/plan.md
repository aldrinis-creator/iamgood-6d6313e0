## What went wrong on 12-Jul at 23:34 IST

- `sos_events` row `42d78690-d852-4697-bb50-7f1b374acfae` was inserted (status `active`, trigger `manual`).
- `send-sos-alert` edge function received **zero** HTTP calls at that time.
- `sos_message_attempts` has **no rows** for the last 6 hours → no WhatsApp / SMS / email / push was ever attempted.
- Auth logs show the JWT was refreshing at the same moment (login 23:32, `bad_jwt: missing sub claim` shortly after) — the client-side `supabase.functions.invoke(...)` call almost certainly failed or was aborted before it reached the edge network.

The SOS pipeline today is entirely browser-driven (`AppContext.triggerSOS`): insert row → then call the edge function from the same tab. If the tab is interrupted between those two steps (auth refresh, tab suspend, screen lock, network blip, dialog close), the event is recorded but **no one is notified and nothing retries**. That is unacceptable for a life-safety feature.

## Fix — make dispatch server-authoritative

### 1. DB trigger fires dispatch the moment an SOS row is inserted

Add an `AFTER INSERT` trigger on `public.sos_events` that calls `send-sos-alert` via `pg_net.http_post` using the service-role key stored in `vault`, passing `{ sos_event_id }`. The trigger runs inside the same transaction that created the row, so if the row exists, dispatch is guaranteed to be scheduled — no dependence on the browser staying alive.

### 2. `send-sos-alert` accepts server-invoked calls

Update `supabase/functions/send-sos-alert/index.ts` to:

- Accept a service-role auth path where the body is just `{ sos_event_id }` (in addition to today's user-JWT path).
- Load the `sos_events` row, resolve `user_id`, fetch accepted guardians, build the message (reusing today's logic), and record `sos_message_attempts` as it does today.
- Idempotency guard: skip if any `sos_message_attempts` row already exists for that `sos_event_id` (so client-invoke + trigger-invoke don't double-send).

### 3. Client stops being the source of truth

In `src/contexts/AppContext.tsx`:

- After inserting `sos_events`, still call `send-sos-alert` (for the fastest possible latency when the tab is healthy), but treat any invoke failure as non-fatal — the DB trigger will cover it.
- Keep the offline-queue path unchanged.

### 4. Safety-net cron (belt-and-braces)

Add a `pg_cron` job every 1 minute: for any `sos_events` row with `status = 'active'`, `created_at > now() - interval '30 minutes'`, and **no rows in `sos_message_attempts**`, re-invoke `send-sos-alert`. Catches the case where the trigger's `pg_net` call itself fails.

### 5. Backfill the missed alert

Manually invoke `send-sos-alert` once for `sos_event_id = 42d78690-d852-4697-bb50-7f1b374acfae` so today's guardians are finally notified (or, if you consider it stale, mark it resolved with a note). Your call — I'll ask before dispatching.

## Files touched

- `supabase/migrations/<new>.sql` — trigger, helper function, cron job, GRANTs.
- `supabase/functions/send-sos-alert/index.ts` — service-role branch + idempotency check.
- `src/contexts/AppContext.tsx` — invoke becomes best-effort, not required for delivery.

## Verification

- Insert a test SOS row via SQL (no browser) → confirm `send-sos-alert` runs and `sos_message_attempts` populates.
- Trigger SOS from the app, then kill the tab immediately after the button press → guardians still receive the alert.
- Confirm no duplicate WhatsApp/SMS when both paths race (idempotency guard).

## Question before I build

For the stranded row `42d78690…` from tonight — **replay the alert to your guardians now, or mark it resolved as stale? mark it stale**

&nbsp;