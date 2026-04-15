

## Fix Build Errors and Add Google Maps API Key Secret

### Current Issues

**Build errors blocking deployment:**

1. **`confirm-payment/index.ts` line 139**: Broken conditional `supabase.rpc ? undefined : 0` that checks if the RPC method exists (always true) instead of checking if the RPC call succeeded. This is a TypeScript error and a logic bug.

2. **`process-email-queue/index.ts`**: Multiple TypeScript type errors caused by stricter Supabase client type inference:
   - Line 63-68: `.insert()` call on `email_send_log` has type mismatch
   - Line 70: `.rpc('move_to_dlq')` parameter type error
   - Line 159: Implicit `any` on `.map((msg) => ...)`
   - Line 164: Implicit `any` on `.filter((id): id is string => ...)`
   - Lines 214, 221, 330: `moveToDlq()` calls fail because the function signature expects a generic client but receives a strictly-typed one

### Solution

**Step 1: Fix `confirm-payment/index.ts`**

Remove the broken `supabase.rpc ?` check (line 139). The proper pattern is to call the RPC and handle errors gracefully. Replace the fallback logic with:

```typescript
if (coupon_code) {
  const { error: couponErr } = await supabase.rpc("increment_coupon_usage", {
    _code: coupon_code,
  });
  if (couponErr) {
    console.error("Failed to increment coupon usage:", couponErr);
  }
}
```

**Step 2: Fix `process-email-queue/index.ts`**

- **Line 57**: Change the `moveToDlq` function signature to accept `any` for the Supabase client:
  ```typescript
  async function moveToDlq(supabase: any, ...)
  ```
  
- **Lines 159, 164**: Add explicit type annotations:
  ```typescript
  .map((msg: any) => ...)
  .filter((id: any): id is string => Boolean(id))
  ```

**Step 3: Add Google Maps API Key Secret**

Request the user to add `VITE_GOOGLE_MAPS_API_KEY` as a runtime secret with their new key value. This makes it available to the frontend via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`.

**Step 4: Update `src/lib/googleMaps.ts`**

Replace the hardcoded key (line 5) with:

```typescript
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
```

Add a guard in the `loadGoogleMapsAPI()` function to reject early if the key is missing:

```typescript
export function loadGoogleMapsAPI(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY not configured"));
  }
  // ... rest of the loader logic
}
```

### Files Modified

- `supabase/functions/confirm-payment/index.ts`
- `supabase/functions/process-email-queue/index.ts`
- `src/lib/googleMaps.ts`
- Secrets: Add `VITE_GOOGLE_MAPS_API_KEY`

### Outcome

All TypeScript build errors resolved, and the Google Maps API key is now stored securely as an environment variable instead of being hardcoded. The app will use the new key you provide.

