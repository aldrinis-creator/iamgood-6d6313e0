

# Fix: Quantity Input UX in Medication Form

## Problem
The quantity fields (`Total Qty`, `Remaining`, `Low Stock Threshold`) use `Number(e.target.value)` in their onChange handlers. When a user tries to delete the current value to type a new one, `Number("")` returns `0`, so the field snaps back to `0` and can't be cleared.

## Fix
Store these three fields as `string` in the form state (instead of `number`), allowing the input to be empty. Convert to `number` only at save time.

### File: `src/components/medications/MedicationList.tsx`

1. **Change `emptyForm` defaults** from numbers to strings:
   - `total_quantity: "30"`, `remaining_quantity: "30"`, `low_stock_threshold: "5"`

2. **Update onChange handlers** to store raw string value:
   - `onChange={(e) => setForm(f => ({ ...f, total_quantity: e.target.value }))}`
   - Same for `remaining_quantity` and `low_stock_threshold`

3. **Update `openEdit`** to convert existing numeric values to strings when populating the form.

4. **Update `handleSave`** to convert strings back to numbers (`Number(form.total_quantity) || 0`) before inserting/updating.

One file changed. No database or backend changes needed.

