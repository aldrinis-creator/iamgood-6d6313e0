

## Fix "Runwal Elina" Search — Revised Approach

### Problem
The Google API key (`AIzaSyC2I7F0chcShNVSf2OCsOA3h6EUPcD1GSU`) only has the **Places Autocomplete** API enabled. TextSearch and Geocoding APIs are not enabled, causing their callbacks to silently hang (timeout). Nominatim doesn't index "Runwal Elina" either.

### Root Cause Summary

| Tier | Result | Why |
|------|--------|-----|
| Tier 1 (Autocomplete) | 0 results | Google doesn't index "Runwal Elina" in autocomplete |
| Tier 2 (TextSearch) | Timeout 8s | API not enabled on key — callback never fires |
| Tier 3 (Geocoder SDK) | Timeout 6s | API not enabled on key — callback never fires |
| Tier 4 (Nominatim) | 0 results | OSM doesn't have this building indexed |

### Solution

Since TextSearch and Geocoding APIs are not enabled on the key and cannot be fixed from code, we need a different approach:

**1. Use Google Places New API (`google.maps.places.Place.searchByText`)** — the console warns that `PlacesService` is legacy. The new `Place` class API may work with the existing key since it's part of the Places API (New), not a separate API. This is the modern replacement Google recommends.

**2. Improve Nominatim search** — append "India" to queries and also try searching with the user's detected city name upfront (not just as a retry).

**3. Add a 5th tier: Photon geocoder** — Photon (by Komoot) indexes more POI data than Nominatim and may have "Runwal Elina". It's free and doesn't require an API key.

### Changes — `src/hooks/usePlaceAutocomplete.ts`

1. **Replace Tier 2 (TextSearch)** with `google.maps.places.Place.searchByText()` — the new Places API. Uses `includedType`, returns a Promise (no callback hanging). Falls back gracefully if not available.

2. **Replace Tier 3 (Geocoder SDK)** with **Photon geocoder** (`https://photon.komoot.io/api/?q=...&lang=en&limit=5`) — free, no API key, better POI coverage than Nominatim.

3. **Enhance Tier 4 (Nominatim)** — always append country context ("India") to the initial search, not just on retry.

4. **Remove dead code** — remove `geocoderService` ref and `geocodingSearch` callback since the Geocoding API doesn't work with this key.

### Technical Detail

```text
BEFORE:
  Tier 2: placesService.textSearch() → hangs forever (API not enabled)
  Tier 3: geocoderService.geocode() → hangs forever (API not enabled)
  Tier 4: Nominatim → 0 results for "Runwal Elina"

AFTER:
  Tier 2: google.maps.places.Place.searchByText() → new API, may work
  Tier 3: Photon geocoder (photon.komoot.io) → better POI coverage
  Tier 4: Nominatim with "Runwal Elina India" → better context
```

### Expected Outcome
"Runwal Elina" should be found via either the new Places API (Tier 2) or Photon geocoder (Tier 3), both of which have better coverage for residential complexes in India.

