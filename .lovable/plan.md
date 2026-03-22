

# Fix: Alternative Selection Not Returning to Order Basket

## Problem
When the user clicks "Alt" on an order item, the flow switches to the Scan tab. The RefillOrder component **unmounts**, losing all `orderItems` state. When an alternative is selected and the tab switches back to Refill, the component remounts with an empty basket — so the `useEffect` that maps `selectedAlternative.forMedId` finds nothing to replace.

## Solution
Lift `orderItems` state up to `MedicationManager` so it persists across tab switches.

### `src/components/medications/MedicationManager.tsx`
- Add `orderItems` state (`useState<OrderItem[]>([])`) at the manager level
- Pass `orderItems` and `setOrderItems` as props to `RefillOrder`

### `src/components/medications/RefillOrder.tsx`
- Accept `orderItems` and `setOrderItems` as props instead of managing them internally
- Remove the local `useState<OrderItem[]>([])` 
- Keep all other order logic (add/remove/confirm) unchanged — they already use `setOrderItems`

### Types
- Export `OrderItem` interface from `RefillOrder.tsx` (or move to `MedicationManager.tsx`) so both files can reference it

This ensures the order basket survives the Refill → Scan → Refill tab transition, and the alternative replacement `useEffect` finds the correct item to update.

