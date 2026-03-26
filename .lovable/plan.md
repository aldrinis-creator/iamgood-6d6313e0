

# Add Medication Refill Ordering for Guardians

## What Changes

Add a "Refill & Order" section inside the Guardian Dashboard's Medications collapsible that shows the ward's low-stock medications and lets the guardian place an order (WhatsApp to pharmacy, save as PDF, share) — the same flow the user has in their RefillOrder component.

## Technical Plan

### 1. Create `src/components/WardRefillOrder.tsx`
A simplified version of `RefillOrder` adapted for guardian use:
- Accept `wardUserId: string` and `wardName: string` as props
- Fetch medications from `medications` table filtered by `wardUserId` (guardian SELECT RLS already exists)
- Show low-stock alerts (remaining <= threshold)
- Order cart: add/remove meds, set quantities
- Order confirmation with WhatsApp send, PDF save, and share — same as user's RefillOrder
- Skip banned medication checks and Jan Aushadhi alternatives (keep it focused; guardian doesn't manage prescriptions)
- No prescription scanning or alternative replacement (guardian-specific simplification)

### 2. Update `src/pages/GuardianDashboard.tsx`
- Import `WardRefillOrder`
- Add it inside the existing Medications `CollapsibleSection` below `WardMedicationAdherence`

| File | Change |
|------|--------|
| `src/components/WardRefillOrder.tsx` | New — ward medication refill ordering for guardians |
| `src/pages/GuardianDashboard.tsx` | Add WardRefillOrder to medications section |

