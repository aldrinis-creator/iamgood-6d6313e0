

# Disable Confirm Button During Re-analysis

## Why
If a user taps "Confirm & Continue" while a food item is being re-analyzed, the old (incorrect) nutritional values get saved. This defeats the purpose of the correction flow.

## Change

**File:** `src/components/NutritionAdvisor.tsx` (~line 778)

Add `disabled={reanalyzingIdx !== null}` to the Confirm & Continue button. This prevents saving while any item's nutrition data is being fetched.

