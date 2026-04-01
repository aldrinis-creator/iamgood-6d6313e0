

# Fix: Jan Aushadhi Orders Not Persisting in Shopping Cart

## Problem
Two bugs in the Jan Aushadhi → Refill order flow:

1. **Jan Aushadhi items vanish on tab switch**: The cart state lives inside `JanAushadhiAlternatives` component. When user switches to the Refill tab, the component may re-render and the internal cart resets.

2. **Jan Aushadhi items not shown in order cart**: When `onOrderFromKendra` calls `addToOrder`, it creates an order item using the original medication's `id`. If that med is already in the order, the duplicate check (`prev.find(o => o.med.id === med.id)`) silently drops it. Even when added, the item reuses the original med object with just the name swapped, making it indistinguishable from regular items.

3. **ID collision**: A Jan Aushadhi generic for "Paracetamol 500mg" gets the same `med.id` as the original Paracetamol entry, so only one can exist in the order at a time.

## Fix

### 1. Give Jan Aushadhi items unique IDs (`RefillOrder.tsx`)
In the `onOrderFromKendra` handler, generate a unique ID for Jan Aushadhi items (e.g., `ja-${Date.now()}`) so they don't collide with regular medication IDs. This allows both the original and generic to coexist in the cart.

### 2. Lift Jan Aushadhi cart confirmation to work directly (`JanAushadhiAlternatives.tsx`)
When user taps "Add to Order" in the Jan Aushadhi cart, each item calls `onOrderFromKendra` which should immediately appear in the RefillOrder cart. The issue is the items need unique IDs (fix #1 above).

### 3. Label Jan Aushadhi items in the order cart (`RefillOrder.tsx`)
Add a visual badge ("Jan Aushadhi") next to items that were added via the generic alternative flow, so users can distinguish them in the combined cart.

### 4. Persist Jan Aushadhi selections across tab switches (`MedicationManager.tsx`)
The `orderItems` state is already lifted to `MedicationManager` — once fix #1 ensures unique IDs, Jan Aushadhi items will persist in the shared `orderItems` array across tab switches.

## Files Changed

| File | Change |
|------|--------|
| `src/components/medications/RefillOrder.tsx` | Fix `onOrderFromKendra` to use unique IDs for Jan Aushadhi items; add "Jan Aushadhi" badge in cart display |
| `src/components/medications/JanAushadhiAlternatives.tsx` | Pass dosage/unit info through `onOrderFromKendra` for better cart display |

