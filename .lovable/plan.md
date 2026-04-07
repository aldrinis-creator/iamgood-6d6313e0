

## Fix "Runwal Elina" Search — All 3 Failing Tiers

The console logs reveal exactly why every tier after Autocomplete fails:

| Tier | Status | Root Cause |
|------|--------|------------|
| Tier 1 (Autocomplete) | ZERO_RESULTS | Google Autocomplete doesn't index "Runwal Elina" — expected, this is why we have fallbacks |
| Tier 2 (TextSearch) | **Timeout (5s)** | The JS SDK `textSearch()` call never returns a callback. The API key likely doesn't have the **Places API** enabled for Text Search, so the request hangs silently instead of returning an error |
| Tier 3 (Geocoding) | **REQUEST_DENIED** | Uses a different API key (`AIzaSyAFMWZxjdj...`) that has HTTP referer restrictions — Geocoding REST API requires unrestricted or server-side keys |
| Tier 4 (Nominatim) | 0 results | OSM doesn't have "Runwal Elina" indexed |

### Fix Strategy

**Use the Google Geocoding API via the JS SDK** instead of a REST API call. The Maps JS SDK (already loaded) includes a `google.maps.Geocoder` class that works with the same API key used for Autocomplete — no referer restriction issues. This eliminates the need for a separate Geocoding API key entirely.

For TextSearch timeout, increase timeout and add a diagnostic log so we can confirm whether the Places API is enabled on the key.

### Changes — `src/hooks/usePlaceAutocomplete.ts`

1. **Add a Geocoder ref** alongside the existing PlacesService ref, initialized in the same `useEffect`
2. **Replace Tier 3 (REST Geocoding)** with `google.maps.Geocoder.geocode()` JS SDK call — uses the same API key as the loaded Maps script, no referer issues
3. **Increase Tier 2 timeout** from 5s to 8s and log when the callback fires vs times out, to diagnose whether TextSearch is truly unsupported or just slow
4. **Remove the hardcoded Geocoding API key** (`AIzaSyAFMWZxjdj...`) — no longer needed

### Technical Detail

```text
BEFORE (Tier 3):
  fetch("https://maps.googleapis.com/maps/api/geocode/json?address=...&key=SEPARATE_KEY")
  → REQUEST_DENIED (referer restrictions)

AFTER (Tier 3):
  new google.maps.Geocoder().geocode({ address: query, region: "in" })
  → Uses the same key loaded with the Maps JS SDK — no restrictions
```

### Expected Outcome
- "Runwal Elina" → found via Tier 3 (JS SDK Geocoder) even when Tier 2 times out
- Tier 2 timeout increased to 8s for better chance of success
- No separate API key needed for Geocoding

