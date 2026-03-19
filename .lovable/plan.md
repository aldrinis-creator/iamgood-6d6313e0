

# Build Dynamic Health Passport with Live Scores & Gamification

## Overview
Replace the current hardcoded Health Passport with a real-time scoring engine that pulls live data from 5 Supabase tables, computes category scores, and shows animated milestone characters when users hit 50%, 70%, and 100%.

## Scoring Logic

### 1. Check-iN (100 pts)
- 3 windows: 7AM, 12PM, 7PM — each worth **33.33 pts**
- Query `check_ins` table for today, status `"responded"` or `"ok"` = full points for that window
- Pending/missed = 0 for that window
- Only score windows that have passed (don't penalize future windows)

### 2. Face Scan (100 pts)
- Query `face_scans` for today (`scanned_at`)
- If at least 1 scan exists today → **100 pts**
- No scan → **0 pts**, show "Start Scan" action button

### 3. Activity (100 pts)
- Query `activity_logs` for today
- 4 metrics, each worth **25 pts**: Steps (goal 10000), Distance (goal 5km), Calories (goal 500), Active Min (goal 120)
- Each metric: `min(actual/goal, 1) × 25`

### 4. Wellness (100 pts)
- Query `wellness_logs` for **yesterday** (previous night's sleep)
- Sleep hours target: 8 hours
- Score: `min(sleep_hours / 8, 1) × 100`

### 5. Medications (100 pts)
- Query today's `medication_logs` joined with `medications` to get total scheduled doses
- Each dose gets equal weight: `100 / totalDoses`
- Status `"taken"` = full points, otherwise 0

### Overall Score
- Average of all 5 categories: `(c1 + c2 + c3 + c4 + c5) / 5`

## Gamification — Animated Milestone Characters

When overall score crosses milestones, show a pop-up toast with an animated emoji character:

| Milestone | Character | Message |
|-----------|-----------|---------|
| 50% | 🌟 | "Halfway there! Keep going!" |
| 70% | 🎯 | "Amazing progress! You're on fire!" |
| 100% | 🏆 | "Perfect score! You're a health champion!" |

- Track shown milestones in component state to avoid repeating
- Use CSS `animate-scale-in` + `animate-fade-in` for the celebration overlay
- Show a brief (3s) animated card overlay on the Health Passport itself, not just a toast

## Files to Change

### `src/components/HealthPassport.tsx` (full rewrite)
- Add `useAuth` hook and Supabase queries for all 5 data sources
- Compute scores with the formulas above
- Track `shownMilestones` in `useRef<Set<number>>` to fire celebrations once per session
- Render milestone celebration overlay with animated character when triggered
- Keep existing SVG ring + category progress bars UI, now driven by live data
- Auto-refresh every 60 seconds via interval
- Color bars: green (≥70), amber (40-69), red (<40)

### `mem://features/health-passport.md`
- Document scoring formulas for future reference

## Technical Details

- No database changes needed — all tables already exist
- Uses `useQuery` from React Query for caching
- Milestone animation: a `div` with `animate-scale-in` that auto-dismisses after 3 seconds
- Face Scan "Start Scan" button navigates to `/my-health` (where FaceScan component lives)

