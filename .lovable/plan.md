

## Add Nutrition to Health Passport + Nutrition Metrics with Multi-Nutrient Trend

### 1. Health Passport — add Nutrition category (User + Guardian view)

**`src/components/HealthPassport.tsx`** & **`src/components/WardHealthPassport.tsx`**
- Add 4th category `"Nutrition"` to the categories array
- Score formula (0–100): based on today's `meal_logs` totals vs. daily calorie goal (`nutrition_personas.daily_calorie_goal`):
  - 50 pts: calories within 80–110% of goal (proportional otherwise)
  - 25 pts: protein ≥ 0.8g/kg body weight (or ≥ 50g fallback)
  - 25 pts: fiber ≥ 25g
- Fetch `meal_logs` + `nutrition_personas` for today; compute alongside existing categories
- Update overall = average of 4 categories (instead of 3)
- Persist `nutrition` value in `health_passport_scores` upsert (replace `nutrition: 0`)
- Add navigation route for Nutrition → `/my-health?tool=Nutrition` (User card only)

### 2. Rename Calorie Tracker → Nutrition Metrics + new Nutrition Trend chart

**`src/components/CalorieTracker.tsx`** (keep file name to avoid import churn)
- Rename heading "Daily Calorie Goal" stays (it's the goal section), but change the chart section:
  - Heading "Calorie Trend" → **"Nutrition Trend"**
  - Replace single-bar Calories chart with a grouped/stacked visual showing **Protein (g), Sodium (mg), Potassium (mg), Fiber (g)** per day
  - Use a normalized line chart: each nutrient on its own line, with a small toggle (chips) to show/hide each — keeps it simple & powerful
  - Compute daily totals by summing across `meal_logs.items[]` JSONB (sodium_mg, potassium_mg) and existing `total_protein_g`, `total_fiber_g` columns
- Where this component is referenced as a label (e.g. NutritionAdvisor's "Calorie Tracker" view button), rename display to **"Nutrition Metrics"**

**`src/components/NutritionAdvisor.tsx`**
- Find any "Calorie Tracker" label and rename to "Nutrition Metrics"

### 3. Guardian Reports — same Nutrition Trend visual

**`src/pages/GuardianReports.tsx`**
- Replace `buildNutritionTrend()` to compute protein, sodium (from items[].sodium_mg), potassium (from items[].potassium_mg), fiber (total_fiber_g) per day
- Replace the single BarChart with the same toggleable LineChart used in CalorieTracker (extract a shared `NutritionTrendChart` component in `src/components/NutritionTrendChart.tsx` to keep parity)
- Update `chartConfigs.nutrition` to define 4 series colors
- Card title stays "7-Day Nutrition" but chart heading inside reads "Nutrition Trend"

### 4. Shared component

**`src/components/NutritionTrendChart.tsx`** (new)
- Props: `data: { label: string; protein: number; sodium: number; potassium: number; fiber: number }[]`, optional `range` selector
- Renders LineChart with 4 toggleable series (badge chips), legend, tooltip with units (g/mg)

### Files
| File | Action |
|------|--------|
| `src/components/HealthPassport.tsx` | Add Nutrition category + scoring, update overall |
| `src/components/WardHealthPassport.tsx` | Add Nutrition category + scoring (read-only) |
| `src/components/CalorieTracker.tsx` | Replace Calorie Trend with Nutrition Trend (4 nutrients) |
| `src/components/NutritionTrendChart.tsx` | New shared toggleable LineChart |
| `src/components/NutritionAdvisor.tsx` | Rename "Calorie Tracker" → "Nutrition Metrics" |
| `src/pages/GuardianReports.tsx` | Use NutritionTrendChart with sodium/potassium from items JSONB |

### Notes
- Sodium/potassium are not stored as table columns; computed by summing `items[]` JSONB per meal log. No DB migration needed.
- `health_passport_scores.nutrition` column already exists.

