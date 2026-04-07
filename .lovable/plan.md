

## Update Google API Keys for MMJ Search

### Problem
The codebase uses a single old API key (`AIzaSyDCeS7...`) for everything — Maps JS loading, Places Autocomplete, and Geocoding. You've now provided dedicated keys with the correct APIs enabled and billing linked.

### Plan

#### 1. Update `src/lib/googleMaps.ts` — Use Places API key
The Google Maps JS library loads the Places library, so it should use the **Places API key**:
```
AIzaSyDCeS7... → AIzaSyC2I7F0chcShNVSf2OCsOA3h6EUPcD1GSU
```

#### 2. Update `src/hooks/usePlaceAutocomplete.ts` — Use both keys
- The `GOOGLE_MAPS_API_KEY` constant (used by the Geocoding REST call) should use the **Geocoding API key**: `AIzaSyAFMWZxjdj-uXJciP4Uf2HGJ_8ZnbP_QIo`
- Add a separate `GOOGLE_PLACES_API_KEY` constant isn't needed here because the Places Autocomplete runs through the JS SDK (which already loaded with the Places key in step 1).

So effectively:
- `googleMaps.ts`: key → `AIzaSyC2I7F0chcShNVSf2OCsOA3h6EUPcD1GSU` (Places key, loads JS + Places library)
- `usePlaceAutocomplete.ts`: key → `AIzaSyAFMWZxjdj-uXJciP4Uf2HGJ_8ZnbP_QIo` (Geocoding key, used only for the REST geocoding fallback)

### Files Changed

| File | Change |
|------|--------|
| `src/lib/googleMaps.ts` | Replace API key with Places key |
| `src/hooks/usePlaceAutocomplete.ts` | Replace API key with Geocoding key |

### Expected Result
Google Places Autocomplete and Geocoding fallback will both work with properly configured, billing-enabled keys. Destination search should return accurate, locally-biased results.

