

## Fix: Frozen Destination Input in MMJ

### Root Cause

The screenshot shows the user typed "Holy family hospital" but **no search results dropdown appeared**. The input accepts text but autocomplete silently fails.

The issue is in the `searchDestination` function (line 144-151). The `locationBias` parameter is passed as a plain object `{ center: {...}, radius: 50000 }` cast with `as any`. The legacy Google Maps `AutocompleteService.getPlacePredictions()` does NOT accept `locationBias` — it expects `location` (a `google.maps.LatLng`) and `radius` (a number) as separate top-level properties. The invalid parameter causes `getPlacePredictions` to silently fail or return no results.

Additionally, when Google Places fails, there's no fallback — the code just sets `searchResults` to `[]` silently.

### Fix

**File: `src/pages/MapMyJourney.tsx`**

1. **Fix `locationBias` → use `location` + `radius`**: Replace the `locationBias` object with proper legacy API parameters:
   ```typescript
   const request: google.maps.places.AutocompletionRequest = {
     input: query,
     ...(originPos && {
       location: new google.maps.LatLng(originPos.lat, originPos.lng),
       radius: 50000,
     }),
   };
   ```

2. **Add Nominatim fallback on Google failure**: If `getPlacePredictions` returns an error status, immediately fall back to Nominatim search so the user always gets results.

3. **Add console logging** for debugging: Log when Google API is loaded vs. when fallback is used, so future issues are easier to diagnose.

### Files to modify
- `src/pages/MapMyJourney.tsx` — fix the `searchDestination` function (lines 144-166)

### Technical details
- `AutocompletionRequest` in legacy Google Maps JS API uses `location: LatLng` + `radius: number`, NOT `locationBias: { center, radius }`
- `locationBias` is only valid for the newer `Place.searchByText()` / `Place.searchNearby()` APIs (not `AutocompleteService`)
- The `as any` cast was hiding the type error

