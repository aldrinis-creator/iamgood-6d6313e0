# Medicine refill pop-up (Ward and Guardian)

## What the user will see
- At **12:00 PM IST**, one pop-up lists **every** medicine that is due for refill. There is one pop-up, not one per medicine.
- It shows on **3 days in a row**: the day a medicine first becomes due, the next day and the day after.
- It shows on the **Ward's phone** and on the phones of their **accepted guardians**. For guardians, the pop-up names the Ward.
- If the app is closed at 12 PM, a phone notification is sent. Tapping it opens the pop-up.
- Buttons: **"Order Refill"** opens the existing refill screen. **"OK"** closes the pop-up.
- **Once a medicine is refilled**, it drops out of the pop-up. If every medicine on the list is refilled, the pop-up stops.
- A medicine counts as "due" when its remaining tablets are at or below its low-stock level. This is the same rule the red Meds badge uses now.

## Rules
- A medicine's 3 days start on the day it first becomes due.
- After 3 pop-ups, that medicine is silent until it is refilled and then runs low again.
- Medicines with refill reminders switched off are skipped.
- No pop-up while someone is signing in, as the app already does for other alerts.

## Technical details
- New column `medications.refill_due_since date` (IST). It is set when stock reaches the threshold and cleared when stock goes back above it. A database trigger handles both, so manual edits and orders are covered.
- New table `refill_alert_log (medication_id, user_id, alert_date)` with a unique key and grants/RLS. The 3-day count and once-a-day firing come from this table.
- New cron edge function `refill-due-alerts`, run daily at 06:30 UTC (12:00 IST), behind the shared internal guard. For each Ward it groups due medicines, sends 1 push and 1 in-app notification (deduped RPC) to the Ward and each accepted guardian, and logs the date.
- New `RefillDuePopup` component, mounted for both roles. It opens when a `refill_due` notification or push arrives, and also on app open after 12 PM if today's alert has not been dismissed. The Realtime subscription is filtered by user_id.
- `sw.ts` handles the `refill_due` push type.
- Tests cover: 3-day limit, refilled medicine excluded, one grouped alert per day.
