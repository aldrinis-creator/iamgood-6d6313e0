

# Mindfulness Exercise: Full-Screen Timer with Single Exercise Lock

## What Changes

**File**: `src/components/WellnessTracker.tsx`

### 1. Single exercise at a time (already works)
The current code already enforces one exercise at a time via `activeExercise` state. No logic change needed — clicking another exercise switches to it.

### 2. Large full-screen timer display
When an exercise is active, show a prominent overlay/expanded view above the exercise grid:
- Large circular timer display with the elapsed time in big font (e.g. `text-5xl font-bold`)
- Exercise name and a circular progress ring showing completion percentage
- A "Stop" button to cancel the exercise
- Disable (dim) the other exercise buttons while one is running so only one can be active

### Technical Approach
- Add a conditional block above the grid: when `activeExercise !== null`, render a centered timer card with:
  - Exercise icon + label
  - Large `formatTimer(exerciseTimer)` in `text-5xl`
  - Circular progress using SVG circle with `stroke-dashoffset`
  - Stop button that resets `activeExercise` and `exerciseTimer`
- Dim non-active exercise buttons with `opacity-40 pointer-events-none`

