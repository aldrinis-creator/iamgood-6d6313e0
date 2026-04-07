

## Fix MMJ Destination Search: Wrong Results & No Location Bias

### Root Cause Found

The destination search returns locations outside the user's city because **the location bias is not working**. Here's why:

The `AutocompleteService.getPlacePredictions()` in the legacy Google Maps JavaScript API uses `location` + `radius` properties — **not** `locationBias`. The current code passes `locationBias`, which is silently ignored by the API. This means every search runs with **no geographic bias at all**, returning results from anywhere in India.

```text
Current (broken):
  locationBias: { center: {lat, lng}, radius: 50000 }   ← ignored by legacy API

Correct:
  location: new google.maps.LatLng(lat, lng)             ← proper bias point
  radius: 50000                                           ← meters
```

### Do You Need a Paid Google Maps API?

**No paid upgrade is needed.** The free tier of Google Maps Platform includes Places Autocomplete. However:
- The API key must have **Places API** enabled in Google Cloud Console
- The project must have **billing enabled** (Google requires a billing account even for the free $200/month credit)
- Without billing, the API silently fails or returns empty results, causing the fallback to Nominatim (which has poor ranking)

The API key in the code (`AIzaSyDCeS7...`) may already work — the fix below will make location bias actually take effect, which should dramatically improve result relevance.

### Plan

#### 1. Fix location bias in `usePlaceAutocomplete.ts`

Replace the incorrect `locationBias` property with the correct `location` + `radius` properties that the legacy `AutocompleteService` actually reads:

```typescript
const request: google.maps.places.AutocompletionRequest = {
  input: query,
  sessionToken: sessionToken.current!,
  componentRestrictions: { country },
  ...(origin && {
    location: new google.maps.LatLng(origin.lat, origin.lng),
    radius: 50000,
  }),
};
```

#### 2. Add error logging to diagnose API key issues

Add a `console.warn` when Google returns a non-OK status so we can see if the API key is actually failing (e.g., `REQUEST_DENIED` means billing/API not enabled):

```typescript
if (status !== google.maps.places.PlacesServiceStatus.OK) {
  console.warn("[PlaceAutocomplete] Google status:", status);
}
```

#### 3. Add `strictBounds` option for tighter local results

When the user has a known origin, pass `strictBounds: false` explicitly (default) but add the option so it can be toggled to `true` if users want only nearby results. This keeps far-away results deprioritized but not excluded.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/usePlaceAutocomplete.ts` | Fix `locationBias` → `location` + `radius`; add status logging |

### Expected Result

After this fix, typing "Fortis" while in Mumbai will show Fortis hospitals in Mumbai first (not Delhi or Chennai). The location bias will actually work, making results feel local and relevant like Uber's search.

