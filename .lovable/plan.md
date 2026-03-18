

## Nutrition Advisor Tab

### Overview
Build a `NutritionAdvisor` component that renders when the "Nutrition" tile is selected in My Health. Based on the screenshot, it shows an AI-powered nutrition guidance UI with four action cards and an "Edit Persona" button.

### New Component: `src/components/NutritionAdvisor.tsx`

**Header section:**
- Title: "Nutrition Advisor"
- Subtitle: "AI-powered meal guidance tailored to you"
- "Edit Persona" button (top-right) — opens a dialog to set dietary preferences (vegetarian/non-veg, allergies, health goals, age, weight)

**4 Action Cards in a 2x2 grid:**
1. **Suggest a Meal Plan** (UtensilsCrossed icon) — "Personalized for this time of day"
2. **Analyze This Meal** (Camera icon) — "Photo scan for calories & nutrients"
3. **Post-Workout Recovery** (Dumbbell icon) — "Recovery meal based on your activity"
4. **I'm Not Feeling Well** (Thermometer icon) — "Gentle meal plan for recovery"

Each card is clickable and opens a panel/dialog with AI-generated content via a backend edge function using Lovable AI.

### Edge Function: `supabase/functions/nutrition-advisor/index.ts`
- Accepts `{ type, persona, context }` where type is one of the four actions
- Uses Lovable AI (`LOVABLE_API_KEY`) with a nutrition-focused system prompt
- Returns meal suggestions, nutritional analysis text, or recovery meal plans
- Handles 429/402 errors

### Database
- **New table: `nutrition_personas`** — stores user dietary preferences (diet_type, allergies, health_goals, weight_kg, age)
- RLS: users CRUD own row only
- Used by the edge function to personalize responses

### Integration
- Update `src/pages/MyHealth.tsx`: import `NutritionAdvisor`, render when `selectedTool === "Nutrition"`

### Files Changed
1. **Migration** — Create `nutrition_personas` table with RLS
2. **`src/components/NutritionAdvisor.tsx`** — New component (header + 4 cards + persona dialog + AI response display)
3. **`supabase/functions/nutrition-advisor/index.ts`** — Edge function for AI meal guidance
4. **`src/pages/MyHealth.tsx`** — Wire up Nutrition render

