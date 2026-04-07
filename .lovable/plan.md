## Auto-Update Stock on Medication Refill

### Current Behavior

When a refill order is confirmed and sent to the pharmacy, **no stock update happens**. The `confirmOrder` function only toggles a UI flag — it never writes to the `medications` table. This is intentional: the order is just a request sent via WhatsApp/PDF, not a delivery confirmation.

### Recommended Approach

Add a **"Mark as Received"** button that appears after the order has been sent. When tapped, it resets `remaining_quantity` to `total_quantity` for each ordered medication.

Automatically updating stock at order time would be incorrect — the user hasn't received the medicines yet.

### Changes

#### 1. Add "Received" action to `RefillOrder.tsx` and `WardRefillOrder.tsx`

After the order is confirmed and sharing options are shown, add a prominent button: **"✓ Received — Update Stock" and allow User to update the stock levels with an edit button else let the current default stock level be updated when the button "Received - Update Stock" is tapped.**

When clicked:

- For each item in `orderItems`, update `medications` set `remaining_quantity = total_quantity` where `id = item.med.id`
- Show a success toast
- Reset the order state and reload medication data

#### 2. Optional: partial quantity update

Instead of resetting to `total_quantity`, show an input per medication so the user can enter the actual quantity received (pre-filled with `total_quantity`).

### Files Changed


| File                                         | Change                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/components/medications/RefillOrder.tsx` | Add "Mark as Received" button after order confirmed; update `remaining_quantity` via Supabase |
| `src/components/WardRefillOrder.tsx`         | Same "Mark as Received" flow for guardian orders                                              |


### Technical Detail

```typescript
const markReceived = async () => {
  for (const item of orderItems) {
    await supabase.from("medications")
      .update({ remaining_quantity: item.qty })
      .eq("id", item.med.id);
  }
  toast.success("Stock updated!");
  setOrderConfirmed(false);
  setOrderItems([]);
  load(); // refresh medication list
};
```

&nbsp;