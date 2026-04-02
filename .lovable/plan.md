

# Fix Battery Warning: Raise Threshold + Ensure It Fires

## Root Cause
The `navigator.getBattery()` API silently fails on unsupported browsers (iOS Safari, Firefox) — the `.then()` simply never resolves, so the component stays at its default `level: 100` and never triggers. Even on supported browsers, the promise may resolve but only fires `levelchange` events at ~1% increments, meaning the initial check is the only reliable trigger point.

## Changes

### File: `src/components/BatteryWarning.tsx`

1. **Raise low-battery threshold from 20% → 30%**
   - Line 100: change `battery.level <= 20` to `battery.level <= 30` and the upper bound on critical check from `> 10` stays, low range becomes `> 10 && <= 30`

2. **Fix: trigger threshold check on initial battery read**
   - Currently `setBattery()` inside the `.then()` callback does trigger a re-render, but the `show` callback may have stale `settings` on first mount. Add `settings` to the `useEffect` dependency for the getBattery hook isn't needed — the threshold effect already depends on `battery` and `show`.
   - The real fix: add a **polling fallback** — if `getBattery` isn't available, poll `navigator.getBattery` every 60s. If it's truly unsupported, log a warning and skip gracefully.

3. **Fix stale `settings` in `update` closure**
   - The `useEffect` on line 24 captures `settings` in its closure but only depends on `session?.user?.id`. Add `settings` to deps (or use a ref for settings) so battery-save uses current values.

4. **Add periodic re-check**
   - After initial battery read, set a 60-second interval that re-reads `batt.level` and calls `setBattery()` — this ensures the threshold effect runs even if `levelchange` events are missed (common on some Android WebViews).

### Summary of threshold logic after fix:
- **≤ 10%** → critical alert (red, shake animation, up to 3 times)
- **11–30%** → low alert (amber, bounce animation, up to 3 times)

One file changed. No database or backend changes.

