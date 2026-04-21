

## Plan — Persistent "Pending Receipt" with "Medications Received" Footer

### Current behavior
After sending an order via WhatsApp, a "Pending Receipt" card appears in `RefillOrder.tsx` and `WardRefillOrder.tsx` — but it's stored in component state only, so it disappears on page refresh, navigation away, or app reload.

### Goal
The pending order card must persist across sessions, devices, and tabs until the User or Guardian explicitly confirms stock receipt. The footer button label changes to **"Medications Received"** for clarity.

---

### What I'll build

**1. New table `medication_orders`** (already partially referenced via `confirmOrder` insert, but not used for UI persistence)

```text
id              uuid pk
user_id         uuid (ward owner of medications)
ordered_by      uuid (user OR guardian who placed order)
items           jsonb  [{ med_id, name, dosage, qty }]
pharmacy_phone  text
send_method     text   'msg91' | 'browser'
status          text   'pending_receipt' | 'received' | 'dismissed'
sent_at         timestamptz default now()
received_at     timestamptz nullable
```

**RLS policies:**
- User can `SELECT/UPDATE` rows where `user_id = auth.uid()`.
- Guardian can `SELECT/INSERT/UPDATE` rows where `user_id` is one of their accepted wards (via existing `guardians` table).
- `INSERT` requires `ordered_by = auth.uid()`.

**2. Update both refill components**

- On successful WhatsApp send (MSG91 or fallback), `INSERT` a row with `status = 'pending_receipt'` and `pharmacy_phone`, `send_method`, `items` snapshot.
- On mount, `SELECT` open orders (`status = 'pending_receipt'`) for the current ward and render them as the pending-receipt card(s).
- Subscribe via Supabase Realtime so a guardian sees orders the user placed (and vice versa) without refreshing.
- Filter selectable Low Stock + Order Medications lists to exclude meds present in any open pending order (cross-session aware).

**3. Pending Receipt card UI changes**

- Persistent across reloads, navigation, tabs, and User ↔ Guardian.
- Footer button relabeled from `✓ Received` to **"Medications Received"** (full-width, primary color).
- Secondary actions retained: **Send again**, **Dismiss** (sets `status = 'dismissed'`, removes card without updating stock — for cancelled/duplicate orders).
- On **"Medications Received"** tap: update stock (`remaining_quantity`) per item using current edited qty, then set order `status = 'received'`, `received_at = now()`.

**4. Cleanup**
Remove the now-redundant in-memory `pendingReceipt` and `lastSendInfo` state in favor of the DB-backed list. The brief 6s success banner stays (transient toast-style confirmation), but the persistent card is now DB-driven.

---

### Files

**New migration:** `medication_orders` table + RLS policies (a basic table already exists per the `confirmOrder` insert; migration will add missing columns `pharmacy_phone`, `send_method`, `received_at`, normalize `status` enum, and add RLS if missing — I'll inspect the current schema first and only add what's missing).

**Modified:**
- `src/components/medications/RefillOrder.tsx` — User app
- `src/components/WardRefillOrder.tsx` — Guardian app

No edge function changes needed.

---

### Edge cases handled

- **Multiple open orders:** rendered as a stacked list, each with its own Receive/Dismiss controls.
- **Guardian places order, user marks received** (or vice versa): Realtime keeps both views in sync.
- **Partial receipt:** user can edit qty per item before tapping "Medications Received" (existing behavior preserved).
- **Cancelled order:** **Dismiss** clears the card without touching stock.

