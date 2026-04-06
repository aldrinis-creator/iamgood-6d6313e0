

## Why SOS SMS Flashes 3 Times on Guardian's Phone

### Root Cause

The `useEffect` in `FallDetectionOverlay` that fires when `countdownExpired` becomes true has **unstable dependencies** that cause it to re-execute multiple times:

```typescript
useEffect(() => {
  if (countdownExpired) {
    triggerSOS();        // ← new identity each render (depends on [session])
    sendFallAlerts();    // ← fires again
    cancelFallAlert();
  }
}, [countdownExpired, triggerSOS, sendFallAlerts, cancelFallAlert]);
```

- `triggerSOS` from `AppContext` is wrapped in `useCallback([session])` — the `session` object changes identity on re-renders, giving `triggerSOS` a new reference
- Each new reference re-triggers the effect while `countdownExpired` is still `true` (React batches `cancelFallAlert`'s state update, so `fallDetected` hasn't flipped to `false` yet)
- Result: `sendFallAlerts()` calls the `send-sos-alert` edge function 2-3 times, each sending an MSG91 WhatsApp message

### Fix

**File: `src/components/FallDetectionOverlay.tsx`**

Add a `useRef` guard (similar to `hasSentRef` in SOSDialog) to ensure alerts are sent exactly once per fall event:

```typescript
const hasSentRef = useRef(false);

useEffect(() => {
  if (countdownExpired && !hasSentRef.current) {
    hasSentRef.current = true;
    triggerSOS();
    sendFallAlerts();
    cancelFallAlert();
  }
}, [countdownExpired, triggerSOS, sendFallAlerts, cancelFallAlert]);
```

Reset the ref when a new fall is detected (when `fallDetected` transitions to `true`):

```typescript
useEffect(() => {
  if (fallDetected) {
    hasSentRef.current = false;
  }
}, [fallDetected]);
```

**File: `src/contexts/AppContext.tsx`** (optional hardening)

Stabilize `triggerSOS` by using `session?.user?.id` instead of `session` in the dependency array:

```typescript
const triggerSOS = useCallback(async () => { ... }, [session?.user?.id]);
```

### Files to modify
- `src/components/FallDetectionOverlay.tsx` — add `hasSentRef` guard
- `src/contexts/AppContext.tsx` — stabilize `triggerSOS` callback dependency

