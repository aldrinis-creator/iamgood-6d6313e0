

## Remove 4 Health Passport Categories & Rename "Last Active"

### Changes

**1. User Health Passport (`src/components/HealthPassport.tsx`)**
- Remove Wellness, Vitals, Nutrition, and Face Scan from initial state, `newCategories` array, `categoryRoutes`, and the upsert call
- Keep only: Check-iN, Activity, Medications (3 categories)
- Change overall divisor from 7 to 3
- Remove unused Supabase queries (wellness_logs, meal_logs, nutrition_personas, face_scans) and their scoring logic
- Remove unused imports if any

**2. Guardian Ward Health Passport (`src/components/WardHealthPassport.tsx`)**
- Same changes: remove 4 categories from state, scoring, `newCategories`, and upsert
- Change overall divisor from 7 to 3
- Remove unused Supabase queries and scoring blocks

**3. Guardian Dashboard (`src/pages/GuardianDashboard.tsx`)**
- Line 686: Change `"Last Active"` to `"Since Last Check-iN"`

### Files to modify
- `src/components/HealthPassport.tsx`
- `src/components/WardHealthPassport.tsx`
- `src/pages/GuardianDashboard.tsx` (line 686)

