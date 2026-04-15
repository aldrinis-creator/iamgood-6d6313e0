

## Fix Build Errors and Add Google Maps Secret

### Problems Identified

**Build Errors (must fix first):**

1. **`confirm-payment/index.ts` line 139** — TypeScript error checking if `supabase.rpc` exists. The code incorrectly writes:
   ```typescript
   .update({ used_count: supabase.rpc ? undefined : 0 })
   ```
   This checks if the *method* exists, not whether the RPC call succeeded. This is a logic bug left from a fallback pattern.

2. **`process-email-queue/index.ts`** — Multiple type errors after recent Supabase client type updates:
   - Lines 63-68: `.insert()` type mismatch on `email_send_log`
   - Line 70: `.rpc('move_to_dlq')` parameter type error
   - Line 159: implicit `any` on `.map((msg) => ...)`
   - Line 164: implicit `any` on `.filter((id): id is string => ...)`
   - Lines 214, 221, 330: `moveToDlq()` supabase client type mismatch

   Root cause: the `moveToDlq` function signature expects a generic Supabase client but the actual client has stricter inferred types.

**User Request:**
Move the hardcoded Google Maps API key to a runtime secret (`VITE_GOOGLE_MAPS_API_KEY`) and update `src/lib/googleMaps.ts` to use `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`.

---

### Fix Plan

#### 1. Fix `confirm-payment/index.ts`
**Lines 131-154:** Remove the broken `supabase.rpc` existence check. The proper pattern is to call the RPC and handle errors. If the RPC fails, silently log and continue (the webhook still succeeded in creating the subscription).

Replace the fallback logic with a simpler approach:
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

This removes the broken conditional and relies on the database function working correctly (which it should — if not, it's a separate issue to debug).

#### 2. Fix `process-email-queue/index.ts`
**Line 57:** Relax the `moveToDlq` function's Supabase client type to accept the generic client returned by `createClient()`:

Change:
```typescript
async function moveToDlq(
  supabase: ReturnType<typeof createClient>,
  ...
```

To:
```typescript
async function moveToDlq(
  supabase: any,  // Accept any Supabase client instance
  ...
```

**Lines 159, 164:** Add explicit type annotations:
```typescript
.map((msg: any) => ...)
.filter((id: string | null): id is string => Boolean(id))
```

This silences the implicit `any` errors without requiring a full type overhaul of the queue message structure.

#### 3. Add Google Maps API Key as Secret
Use the `add_secret` tool to prompt the user to enter `VITE_GOOGLE_MAPS_API_KEY` with the existing value from `src/lib/googleMaps.ts`:
```
AIzaSyC2I7F0chcShNVSf2OCsOA3h6EUPcD1GSU
```

#### 4. Update `src/lib/googleMaps.ts`
Replace:
```typescript
const GOOGLE_MAPS_API_KEY = "AIzaSyC2I7F0chcShNVSf2OCsOA3h6EUPcD1GSU";
```

With:
```typescript
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
```

Add an error guard:
```typescript
export function loadGoogleMapsAPI(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY not configured"));
  }
  ...
```

---

### Files to Modify
1. `supabase/functions/confirm-payment/index.ts` — fix coupon increment logic
2. `supabase/functions/process-email-queue/index.ts` — fix type annotations
3. `src/lib/googleMaps.ts` — use environment variable
4. Secrets — add `VITE_GOOGLE_MAPS_API_KEY`

