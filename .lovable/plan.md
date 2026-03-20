

# Auto-Enable Motion Sensors — Remove Recurring Permission Prompt

## Problem
The "Motion Sensors Required" banner appears frequently on non-iOS devices and nags users. On Android/desktop, no permission is needed. On iOS, the permission prompt requires a user gesture but should only be shown once, not repeatedly.

## Changes

### `src/hooks/useFallDetection.ts`
- Change initial `permissionState` from `"unknown"` to `"granted"` by default
- In the mount effect, only set to `"unknown"` if iOS permission API is detected AND permission hasn't been granted yet
- Store permission result in `localStorage` so once granted on iOS, it's remembered and never asked again

### `src/components/FallDetectionOverlay.tsx`
- Remove the persistent bottom banner for the permission prompt
- Instead, only show a one-time subtle toast/notification on iOS if permission is truly needed, or fold the permission request into Settings where fall detection is toggled on

## Technical Detail
```typescript
// useFallDetection.ts — default to granted, only check iOS
const [permissionState, setPermissionState] = useState<"unknown" | "granted" | "denied">(() => {
  const DME = DeviceMotionEvent as any;
  if (typeof DME.requestPermission !== "function") return "granted"; // Android/desktop
  if (localStorage.getItem("motion_permission") === "granted") return "granted";
  return "unknown";
});

// After successful iOS permission grant:
localStorage.setItem("motion_permission", "granted");
```

The overlay banner block (`if (enabled && permissionState === "unknown")`) will be removed entirely. On iOS, the permission will be requested automatically when fall detection is first enabled in Settings (via the existing toggle handler).

