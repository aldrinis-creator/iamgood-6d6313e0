

# Medication Refill & Jan Aushadhi Enhancements

## Overview
Four related improvements to the medication management and Jan Aushadhi features.

---

## 1. User-Added Jan Aushadhi Kendra with Detailed Address

**Current**: `AddFacilityDialog` has generic name/phone/address fields. For `janaushadhi` type, address is free-text with geocoding.

**Change**: When `type === "janaushadhi"`, show structured address fields:
- Shop Name (required)
- Phone Number
- Pincode (required)
- Road Name/Number (required)
- Area (required)
- City (required)
- State (optional)

Auto-geocode using pincode + city for coordinates. Save into `user_facilities` table (already supports `janaushadhi` facility_type). Compose full address string from structured fields.

**Files**: `src/components/facilities/AddFacilityDialog.tsx`

---

## 2. Red Highlight on Tablets & Refill Tabs When Refill Due

**Current**: `MedicationManager` tabs have no visual indicator for low stock.

**Change**:
- Pass `hasLowStock` boolean from `MedicationManager` (query medications where `remaining_quantity <= low_stock_threshold`)
- Apply red styling (`text-destructive`) to "Meds" and "Refill" `TabsTrigger` when any medication is low stock
- Remove red styling once all medications are replenished (re-query after refill)

**Files**: `src/components/medications/MedicationManager.tsx`

---

## 3. Doctor & Hospital Name on Order Confirmation

**Current**: `confirmOrder()` immediately shows the share screen.

**Change**:
- Before final confirmation, show a form requiring **Doctor Name** and **Hospital/Clinic Name**
- Persist these values in `localStorage` (key: `checkin_order_doctor_info`) so they auto-fill next time
- Allow editing with a save button
- Include doctor/hospital info in `buildOrderText()` and PDF output

**Files**: `src/components/medications/RefillOrder.tsx`

---

## 4. Jan Aushadhi Shopping Cart Integration + Direct Kendra Navigation

**Current**: Tapping "Order" on Jan Aushadhi alternatives adds to the main order list but nothing visible happens in the Jan Aushadhi section. "Find Nearest Jan Aushadhi Kendra" navigates via query params.

**Changes**:

### 4a. Jan Aushadhi Cart
- When user taps "Order" on a Jan Aushadhi alternative, add it to a **visible cart within the JanAushadhiAlternatives component**
- Show cart summary at bottom with item count and "Confirm Order" button
- User can continue selecting more items from both Jan Aushadhi alternatives and the Order Medications list
- On confirm, show the final cart (same confirmation flow as regular orders)
- Lift Jan Aushadhi cart items into the shared `orderItems` state in `MedicationManager`

### 4b. Direct Kendra Navigation
- Change `onFindKendra` to navigate to the Jan Aushadhi facility view directly: `navigate("/my-health?tool=Services&facility=janaushadhi")`
- This already works via `HealthServices` useEffect — just ensure it opens correctly

**Files**: `src/components/medications/JanAushadhiAlternatives.tsx`, `src/components/medications/RefillOrder.tsx`, `src/components/medications/MedicationManager.tsx`

---

## Implementation Summary

| File | Changes |
|------|---------|
| `src/components/facilities/AddFacilityDialog.tsx` | Structured address fields for Jan Aushadhi type |
| `src/components/medications/MedicationManager.tsx` | Low-stock query, red tab styling, pass cart state |
| `src/components/medications/RefillOrder.tsx` | Doctor/hospital form before confirmation, include in order text/PDF |
| `src/components/medications/JanAushadhiAlternatives.tsx` | Visual cart for selected Jan Aushadhi items, confirm flow |

No database changes required — all existing tables support these features.

