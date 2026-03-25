

# Re-analyze Corrected Food Items for Accurate Nutrition Data

## Problem

When a user corrects a misidentified food (e.g., changes "Banana" to "Brinjal"), the current code only updates the display name and sets confidence to 100. The nutritional values (calories, protein, carbs, etc.) remain from the original wrong identification. This gives users a false sense of accuracy.

## Solution

When a user edits a food name or selects an alternative, call the edge function to get correct nutritional data for the corrected item, then update that item's full data in the results.

## Changes

### 1. Edge Function — Add single-item re-analysis type (`nutrition-advisor/index.ts`)

Add a new `type: "reanalyze_item"` handler that accepts a food name and user persona, then returns nutritional data for that specific item. This uses a simple text prompt (no image) since the user has already identified the food.

Add a new system prompt:
- "Given this food item name, return its detailed nutritional breakdown as a single-item JSON array."
- Uses the same `jsonFormatAnalyze` schema so the response structure is consistent.

### 2. UI — Re-fetch nutrition on name change (`NutritionAdvisor.tsx`)

- When `handleSelectAlternative` or `handleSaveEditName` is called, show a small loading spinner on that item
- Call the edge function with `type: "reanalyze_item"` and the corrected food name
- On success, replace the entire item object (all nutritional fields) with the new data, keeping `confidence: 100`
- On failure, keep the old data but show a toast warning that nutrition values may be inaccurate

### Files Changed

- `supabase/functions/nutrition-advisor/index.ts` — add `reanalyze_item` type and system prompt
- `src/components/NutritionAdvisor.tsx` — add re-analysis call when food name is corrected, with per-item loading state

