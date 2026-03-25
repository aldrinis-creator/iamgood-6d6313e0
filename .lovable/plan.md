

# Improve Meal Image Recognition Accuracy

## Problem

The AI model (Gemini 2.5 Flash) misidentifies visually similar foods — brinjal slices as banana, avocado as cucumber. This leads to incorrect nutritional data being logged.

## Root Cause

1. **Weaker vision model**: Using `gemini-2.5-flash` for image analysis — a cost-optimized model with lower visual accuracy
2. **No confirmation step**: Results are shown as final with no way for the user to correct misidentified items before saving
3. **Generic prompt**: The system prompt doesn't instruct the model to express uncertainty or consider Indian cuisine context for ambiguous items

## Solution — Three Changes

### 1. Upgrade Vision Model (Edge Function)

**File:** `supabase/functions/nutrition-advisor/index.ts`

Switch image analysis from `google/gemini-2.5-flash` to `google/gemini-2.5-pro` — the strongest multimodal model available. This alone significantly reduces misidentification.

### 2. Enhance System Prompt for Accuracy

**File:** `supabase/functions/nutrition-advisor/index.ts`

Add to the `analyze_meal` system prompt:
- Explicit instruction to consider Indian cuisine context (brinjal/baingan, bitter gourd, etc.)
- Instruction to add a `confidence` field (0-100) per item indicating how certain the model is about the identification
- Instruction to include an `alternatives` field listing other foods it could be if confidence is below 80%
- Remind the model to distinguish visually similar foods (brinjal vs banana, avocado vs cucumber, etc.)

### 3. Add User Confirmation/Edit Step (UI)

**File:** `src/components/NutritionAdvisor.tsx`

After AI returns results but before saving to the calorie tracker:
- Show each identified food item with its `confidence` score
- Items with confidence < 80% are highlighted in amber with the `alternatives` list shown as selectable chips
- User can tap an alternative to **re-query** that single item with a corrected name, or manually edit the food name
- An "Confirm & Save" button replaces the current auto-display, so the user explicitly approves the identification

### Updated Fields in Response Schema

Add two new fields to `jsonFormatAnalyze`:
- `confidence` (number 0-100): how certain the model is about the food identification
- `alternatives` (string[]): other possible foods if confidence is below 80%

## Files Changed

- `supabase/functions/nutrition-advisor/index.ts` — upgrade model, enhance prompt, add confidence/alternatives fields
- `src/components/NutritionAdvisor.tsx` — add confirmation step with edit capability for low-confidence items

