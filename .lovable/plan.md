

# Include Full Wellness Data in Health Passport Score

## Problem
The Wellness category in the Health Passport only uses `sleep_hours` from `wellness_logs`. Mindfulness minutes, mood, energy, stress, and sleep quality are all tracked in the WellnessTracker but ignored by the Health Passport score.

## Changes

### 1. Update Wellness Score Calculation (`src/components/HealthPassport.tsx`)
- Fetch today's wellness log (not yesterday's) in addition to yesterday's sleep data
- Compute a composite Wellness score from 5 sub-metrics, each worth 20 points:
  - **Sleep** (yesterday): `min(sleep_hours / 8, 1) * 20`
  - **Sleep Quality** (yesterday): `min(sleep_quality / 5, 1) * 20`
  - **Mood Score**: `min(mood_score / 5, 1) * 20`
  - **Energy Level**: `min(energy_level / 5, 1) * 20`
  - **Mindfulness**: `min(mindfulness_minutes / 15, 1) * 20` (15 min daily goal)
- Use today's log for mood/energy/mindfulness, yesterday's for sleep

### 2. Update Ward Health Passport (`src/components/WardHealthPassport.tsx`)
- Apply the same composite wellness scoring for consistency

### Technical Details
- No database changes needed -- all fields already exist in `wellness_logs`
- Add a second parallel fetch for today's `wellness_logs` entry
- Both files use the same scoring formula for parity

