

## Three Changes: Red Glow for Refill Due, Reorder Manage Bar, Guardian Order Sync

### 1. Red border/glow on "My Health" tab and bottom nav when refill is due

**Current**: The Appointments tab glows red when there are due appointments. My Health has no such indicator.

**Fix**: Create a shared hook `useRefillDue` that checks `medications` for any low-stock items. Use it in:
- `AppHeader.tsx` — add `glow` property to the "My Health" tab (same red ring + pulse dot as Appointments)
- `NavTabs.tsx` — add a badge/red icon treatment to the "My Health" bottom tab
- `MyHealth.tsx` — add red border to the "Tablets" grid button when refill is due

### 2. Move "Manage Medications" collapsible bar above "Medication Manager" heading

**Current order**: Header → TodaySchedule → Manage Medications collapsible

**New order**: Manage Medications collapsible → Header → TodaySchedule

This puts the management actions at the top for quicker access.

### 3. Guardian refill order visibility for the User

**Problem**: When a guardian places a refill order via `WardRefillOrder`, there's no record — it's purely local state. The user's Tablets dashboard has no idea.

**Fix**: 
- Create a new `medication_orders` table to persist orders placed by either user or guardian
- When guardian confirms an order in `WardRefillOrder`, insert a row into `medication_orders` with `ordered_by` (guardian's user_id), `user_id` (ward's user_id), items, and status
- In the user's `RefillOrder` component, query `medication_orders` for pending/confirmed orders and display a card showing "Your guardian ordered these medications" with order details
- Add RLS so users can see orders for their own `user_id` and guardians can insert/view orders for their wards

### Files to modify

| File | Change |
|------|--------|
| `src/hooks/useRefillDue.ts` | **New** — shared hook checking medications low stock |
| `src/components/AppHeader.tsx` | Add red glow to "My Health" tab when refill due |
| `src/components/NavTabs.tsx` | Add red icon/badge to "My Health" bottom tab when refill due |
| `src/pages/MyHealth.tsx` | Add red border to "Tablets" button when refill due |
| `src/components/medications/MedicationManager.tsx` | Move Manage Medications collapsible above the header |
| **DB migration** | Create `medication_orders` table with RLS |
| `src/components/WardRefillOrder.tsx` | Persist order to `medication_orders` on confirm |
| `src/components/medications/RefillOrder.tsx` | Show guardian-placed orders card |

### Technical Detail

**`medication_orders` table schema**:
```sql
CREATE TABLE public.medication_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,           -- the ward/user whose meds are ordered
  ordered_by uuid NOT NULL,        -- who placed the order (user or guardian)
  items jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'ordered',  -- ordered, received
  doctor_name text,
  hospital_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medication_orders ENABLE ROW LEVEL SECURITY;
-- Users see their own orders
CREATE POLICY "Users can view own orders" ON public.medication_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Users can update own orders (mark received)
CREATE POLICY "Users can update own orders" ON public.medication_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
-- Guardians can insert for wards
CREATE POLICY "Guardians can insert ward orders" ON public.medication_orders FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medication_orders.user_id AND g.status = 'accepted'));
-- Guardians can view ward orders
CREATE POLICY "Guardians can view ward orders" ON public.medication_orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = medication_orders.user_id AND g.status = 'accepted'));
-- Users can insert own orders
CREATE POLICY "Users can insert own orders" ON public.medication_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
```

**`useRefillDue` hook**: Queries `medications` where `remaining_quantity <= low_stock_threshold` for current user; returns `boolean`. Subscribes to realtime changes on `medications` table.

**Guardian order card in user's RefillOrder**: Shows pending orders with items list, ordered-by name (fetched from profiles), and a "Mark as Received" action that updates both the order status and medication stock quantities.

