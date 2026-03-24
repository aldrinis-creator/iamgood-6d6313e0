# Nutrition Meal Analysis — Detailed Parameter List View

## What Changes

When "Analyze this Meal" returns results, show each ingredient's nutrition as a **detailed parameter list** (like the screenshot) instead of the current compact calorie badge + macro bar. The screenshot shows a clean vertical list: parameter label on the left, colored value on the right, with divider lines between rows.

## Approach

### 1. Expand the AI response schema

**File:** `supabase/functions/nutrition-advisor/index.ts`

Add more fields to the `analyze_meal` JSON format only:

- `saturated_fat_g`, `polyunsaturated_fat_g`, `monounsaturated_fat_g`, `trans_fat_g`
- `cholesterol_mg`, `sodium_mg`, `potassium_mg`, `sugar_g`
- `vitamin_a_iu`, `vitamin_c_mg`, `calcium_mg`, `iron_mg`

These fields are optional (AI best-effort estimates). Other action types (`meal_plan`, `post_workout`, `feeling_unwell`) keep the current compact format.

### 2. Add `DetailedNutritionList` component

**File:** `src/components/NutritionAdvisor.tsx`

A new component matching the screenshot style:

- Each row: parameter name (dark text) + value (colored, e.g. amber/orange) separated by a pink/accent divider line
- Rows: Calories, Carbohydrates, Protein, Fat, Saturated Fat, Polyunsaturated Fat, Monounsaturated Fat, Trans Fat, Cholesterol, Sodium, Potassium, Fiber, Sugar, Vitamin A, Vitamin C, Calcium, Iron 
- Skips rows where value is 0 or not provided
- One such list per ingredient, with the ingredient name as header
- Use color to differentiate

### 3. Conditional rendering in results

**File:** `src/components/NutritionAdvisor.tsx`

- When `activeAction === "analyze_meal"` and structured data exists: render `DetailedNutritionList` per item instead of the calorie badge + MacroBar
- Benefits, issues, suggestions, and health rating cards continue to render below each item's nutrition list — no change there
- For all other action types: keep current compact card layout

### 4. Update `NutritionItem` interface

**File:** `src/components/NutritionAdvisor.tsx`

Add optional fields to match the expanded schema:

```
saturated_fat_g?: number;
polyunsaturated_fat_g?: number;
monounsaturated_fat_g?: number;
trans_fat_g?: number;
cholesterol_mg?: number;
sodium_mg?: number;
potassium_mg?: number;
sugar_g?: number;
vitamin_a_iu?: number;
vitamin_c_mg?: number;
calcium_mg?: number;
iron_mg?: number;
```

## Files Changed

- `supabase/functions/nutrition-advisor/index.ts` — expand `analyze_meal` JSON schema with micronutrients
- `src/components/NutritionAdvisor.tsx` — add `DetailedNutritionList`, update interface, conditional rendering