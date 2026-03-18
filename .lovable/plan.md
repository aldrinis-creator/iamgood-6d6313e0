

## Add Goal Targets with Progress Indicators to Activity Tracker

### Overview
Add default goal targets for each of the 9 metrics and display a circular/radial progress indicator on each summary card showing how close the user is to their daily goal.

### Changes

**`src/components/ActivityTracker.tsx`**

1. Add a `goal` field to each entry in the `METRICS` array with sensible defaults:
   - Heart Rate: 80 bpm (resting target), Steps: 10000, Distance: 5 km, Cadence: 160 spm, Calories: 500 kcal, Active Minutes: 120 min, Breaths: 16 /min, Floors: 10, SpO2: 98%

2. Replace the plain summary cards with progress-enhanced cards:
   - Add a small circular progress ring (SVG) behind/around the icon on each card
   - Show percentage of goal achieved
   - Color the ring based on completion: partial = metric color, 100%+ = success green

3. Use the existing `Progress` component or a lightweight SVG circle for the radial indicator to keep it compact in the 3x3 grid.

### No database or migration changes needed
Goals are hardcoded defaults for now (no persistence). This keeps the change simple and self-contained.

### Files Changed
1. **`src/components/ActivityTracker.tsx`** — Add goals to METRICS, render progress rings on summary cards

