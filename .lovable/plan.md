# Vitals Monitor Overhaul + Vitals & Nutrition Scores in Health Passport

## Overview

Four interconnected changes: revamp Vitals Monitor fields, add Vitals Score and Nutrition Score to the Health Passport, and move manual meal entry from Calorie Tracker to the Nutrition Advisor's "Analyze this Meal" section.

---

## 1. Database Migration — Add new vitals columns to `activity_logs`

Add columns to `activity_logs` table:

- `respiration_rate` (integer, nullable, default 0) — breaths/min
- `bp_systolic` (integer, nullable, default null) — mmHg
- `bp_diastolic` (integer, nullable, default null) — mmHg
- `temperature_c` (numeric, nullable, default null) — °C
- `glucose_mg_dl` (integer, nullable, default null) — mg/dL

These columns allow manula and wearable entry of vitals data with a tab that says, "Load data from Wearable"

---

## 2. Vitals Monitor Dashboard — Update metrics and chart

**File:** `src/components/VitalsMonitor.tsx`

**Remove:** Stress, Steps, Calories metric cards.

**Replace with new metrics (9 total, grid-cols-3):**

- Heart Rate (bpm) — from activity_logs
- SpO2 (%) — from activity_logs
- Respiration Rate (breaths/min) — new column
- Blood Pressure (mmHg) — shows "Sys/Dia" format
- Temperature (°C) — new column
- Glucose (mg/dL) — new column
- Activity Duration (min) — pulled from `active_minutes` in activity_logs
- Calories Burnt (kcal) — pulled from `calories` in activity_logs
- Steps / Distance — pulled from activity_logs (steps + distance_km)
- Sleep (hrs) — from wellness_logs

**Add manual entry form** for vitals that can't come from wearables (BP, temperature, glucose, respiration rate) — small inline form with Save button that updates today's `activity_logs` row.

**Update chart:** Add respiration rate line to the 7-day trend chart alongside HR and SpO2.

**Update AI Insights payload:** Include all new fields (respiration_rate, bp, temperature, glucose) so the AI considers them.

---

## 3. Health Passport — Add Vitals Score and Nutrition Score

**File:** `src/components/HealthPassport.tsx`

Currently 4 categories (Check-iN, Activity, Wellness, Medications) averaged over 4. Add two more:

**Vitals Score (out of 100):**

- 20 pts: Heart Rate logged today (in normal range 50-100 = full, else partial)
- 20 pts: SpO2 logged (>95 = full, >90 = partial)
- 20 pts: BP logged (sys 90-140 & dia 60-90 = full)
- 20 pts: Temperature logged (36-37.5°C = full)
- 20 pts: Glucose logged (70-140 mg/dL = full)
- If a metric has no data, that 20-pt bucket scores 0 (encourages logging)

**Nutrition Score (out of 100):**

- Fetch today's `meal_logs` (from either AI analysis or manual entry)
- 30 pts: At least one meal logged
- 20 pts: 2+ meals logged
- 25 pts: Calories within ±20% of daily goal (from `nutrition_personas.daily_calorie_goal`)
- 25 pts: Protein > 10% of calories (basic macro balance check)

**Overall score** now averages over 6 categories instead of 4.

Add route mappings: Vitals → `/my-health?tool=Vitals`, Nutrition → `/my-health?tool=Nutrition`.

**File:** `src/components/WardHealthPassport.tsx` — Mirror the same Vitals Score and Nutrition Score logic for the guardian view.

---

## 4. Move Manual Meal Entry to Nutrition Advisor

**File:** `src/components/NutritionAdvisor.tsx`

- Add a "Log Meal Manually" button alongside the "Take Photo" / "Upload" options in the "Analyze this Meal" view.
- When tapped, show the manual entry form (meal name, type, calories, protein, carbs, fats, fiber) inline.
- Save to `meal_logs` table (same logic currently in CalorieTracker).

**File:** `src/components/CalorieTracker.tsx`

- Remove the manual meal entry form and "Log Meal Manually" button.
- CalorieTracker becomes read-only display: goal setting, date navigation, daily log list, and chart.

---

## Files Changed

- **Migration SQL** — add 5 columns to `activity_logs`
- `src/components/VitalsMonitor.tsx` — new metrics, manual vitals entry form, updated AI payload
- `src/components/HealthPassport.tsx` — add Vitals Score + Nutrition Score (6 categories)
- `src/components/WardHealthPassport.tsx` — mirror Vitals + Nutrition scores
- `src/components/NutritionAdvisor.tsx` — add manual meal entry form
- `src/components/CalorieTracker.tsx` — remove manual entry form