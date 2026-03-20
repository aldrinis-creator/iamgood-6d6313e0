

# Fix Fall Detection Not Triggering on Real Phones

## Root Causes

There are **three issues** preventing fall detection from working on real phones:

### 1. iOS requires explicit permission request
On iOS 13+, `DeviceMotionEvent.requestPermission()` must be called from a user gesture (tap) before `devicemotion` events fire. The current code just adds the event listener silently — iOS will block it.

### 2. Thresholds are too strict for a phone drop
The current algorithm expects a "human fall" signature (free-fall → impact), but the user is testing by **dropping the phone**. A phone drop from hand height (~1.5m) produces:
- Very brief free-fall (~0.5s)
- Impact magnitude varies widely depending on surface

The **medium** sensitivity requires magnitude < 4 m/s² for free-fall AND > 30 m/s² for impact — a phone landing on carpet or a bed won't hit 30. Even on hard floor, the accelerometer may saturate or the event rate may miss the spike.

### 3. No permission state tracking or user prompt
There's no UI telling the user that motion permissions are needed, and no way to request them.

## Plan

### Changes to `src/hooks/useFallDetection.ts`
1. **Add iOS permission request** — export a `requestMotionPermission()` function that calls `DeviceMotionEvent.requestPermission()` (when available) and tracks permission state
2. **Add `permissionGranted` state** so the UI can show a prompt if needed
3. **Lower thresholds slightly** for "high" sensitivity to better catch phone drops:
   - high: freeFall 6 → impact 18
   - medium: freeFall 5 → impact 25
   - low: freeFall 3 → impact 35
4. **Widen the free-fall-to-impact window** from 500ms to 800ms — phone drops from hand height take ~550ms

### Changes to `src/components/FallDetectionOverlay.tsx`
1. Add a one-time **"Enable Motion Sensors"** button that calls `requestMotionPermission()` when permission hasn't been granted yet (iOS requirement)

### Changes to `src/pages/Settings.tsx`
1. When fall detection is toggled ON, trigger the motion permission request so the user grants access immediately

### No database changes needed.

## Summary of threshold changes

```text
Sensitivity   freeFall (m/s²)   impact (m/s²)   window (ms)
─────────────────────────────────────────────────────────────
high          6                 18              800
medium        5                 25              800
low           3                 35              800
```

