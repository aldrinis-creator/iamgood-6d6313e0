

# Fix Activity Tracker — Missing iOS Motion Permission

## Root Cause

The Activity Tracker **never requests iOS DeviceMotionEvent permission**. On iOS 13+, the `devicemotion` event silently does nothing without explicit permission granted via a user gesture. The Fall Detection code has this permission flow (`requestMotionPermission()` in `useFallDetection.ts`), but the Activity Tracker's `useStepCounter` and `useMotionHeartRate` hooks skip it entirely. This is why:

- No permission prompt ever appears before/after starting a session
- All readings stay at zero
- The other instance works because it may have granted permission through a different path (e.g. Fall Detection toggle)

## Fix

**File: `src/components/ActivityTracker.tsx`**

1. Import `requestMotionPermission` from `useFallDetection.ts` (already exported)
2. In `handleStartSession`, call `await requestMotionPermission()` **before** activating the session — this runs inside a user gesture (button tap), which is required by iOS
3. If permission is denied, show a toast explaining that motion sensors are needed and do not start the session
4. Store permission state in component state so we can show a visual indicator if sensors are unavailable

**Changes (~15 lines):**

```typescript
import { requestMotionPermission } from "@/hooks/useFallDetection";

// In handleStartSession:
const handleStartSession = async () => {
  // Request iOS motion permission (no-op on Android)
  const perm = await requestMotionPermission();
  if (perm === "denied") {
    toast({
      title: "Motion Sensors Blocked",
      description: "Please allow motion sensor access in your browser settings to track activity.",
      variant: "destructive",
    });
    return;
  }
  // ... existing session start logic
};
```

Also add a small "Sensors active" / "No sensor" indicator below the session header so users know if data will flow.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ActivityTracker.tsx` | Add motion permission request in `handleStartSession`, add sensor status indicator |

No database or migration changes needed.

