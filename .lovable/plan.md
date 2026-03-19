

# Fix Check-in Auto-Refresh + Update Green to Emerald #50C878

## Two Issues

### 1. Check-in card doesn't auto-refresh when a new window opens
The `CheckInCard` only calls `loadCurrentCheckIn` once on mount. When the clock crosses 7AM/12PM/7PM, the heart doesn't appear until the user reloads the app. The audio hook fires within 2 minutes of the hour but the UI never updates.

**Fix:** Add an interval that re-runs `loadCurrentCheckIn` every 30 seconds. When the current window changes, it will automatically detect the new window, create a pending check-in, and show the heart. Also trigger audio alert from within the card component when a new window activates.

### 2. Green color feels drab
Current success green is `hsl(160 84% 39%)` — a teal-ish green. Replace with Emerald Green #50C878 which is `hsl(145 47% 55%)` — brighter and more vibrant.

**Changes:**
- Update `--success` CSS variable in both light and dark themes
- Update the dark mode `--primary` (currently same teal green) 
- Update hardcoded `hsl(160 84% 39%)` reference in `CheckInCard.tsx`
- Update the Switch component to use `data-[state=checked]:bg-success` instead of `bg-primary` so all toggles turn emerald when on

## Files to Change

### `src/index.css`
- Light mode: `--success: 145 47% 55%`
- Dark mode: `--success: 145 47% 55%` and `--primary: 145 47% 55%`

### `src/components/CheckInCard.tsx`
- Add a 30-second interval that calls `loadCurrentCheckIn` to detect new check-in windows automatically
- Update hardcoded `hsl(160 84% 39%)` to `hsl(145 47% 55%)`

### `src/components/ui/switch.tsx`
- Change `data-[state=checked]:bg-primary` to `data-[state=checked]:bg-success` so all toggle switches show emerald green when active

### `src/hooks/useCheckInAudio.ts`
- No changes needed — already fires audio within 2 minutes. The real issue was the UI not refreshing, not the audio hook itself.

### `mem://index.md`
- Update the success color reference from `160 84% 39%` to `145 47% 55%` / `#50C878`

