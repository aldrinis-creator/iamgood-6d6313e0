

# Pre-Check-in Pulsing Heart + Fix Emerald Green Color

## Two Changes

### 1. Show pulsing red heart 30 minutes before check-in time

Yes, this is a great idea — it creates anticipation and a visual nudge before the window opens.

**Current behavior:** The heart only shows when a check-in window is active and pending.
**New behavior:** Starting 30 minutes before each check-in time (6:30 AM, 11:30 AM, 6:30 PM), show a pulsing red heart with a "Coming up in X minutes" message. When the window opens, it transitions to the normal "Tap to check in" state.

**Changes in `src/components/CheckInCard.tsx`:**
- Add an `isApproaching` state that becomes true when the current time is within 30 minutes before the next check-in
- When `isApproaching` is true AND no current window is pending, show the pulsing heart with text like "Check-iN coming up in 12 minutes"
- The existing countdown timer already tracks time to next check-in, so we just need to change the UI when `timeLeft` is ≤ 30 minutes

### 2. Fix Emerald Green — use the brighter green from the screenshot

The screenshot shows a vivid green around **`#3CD856`** which is approximately `hsl(134 63% 48%)`. The current `hsl(145 47% 55%)` is too muted/pastel.

**Changes in `src/index.css`:**
- Light mode `--success`: change from `145 47% 55%` to `134 63% 48%`
- Dark mode `--success`: same `134 63% 48%`
- Dark mode `--primary`: same `134 63% 48%` (currently set to match success)

**Update `mem://index.md`:**
- Update success color reference to `134 63% 48%` / `#3CD856`

## Files to Change

| File | Change |
|------|--------|
| `src/components/CheckInCard.tsx` | Add 30-min pre-window approaching state with pulsing heart |
| `src/index.css` | Update `--success` HSL values in both themes to `134 63% 48%` |
| `mem://index.md` | Update color reference |

