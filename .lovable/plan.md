## Fix MMJ Destination Search — Locations Not Displaying

### Diagnosis

The screenshot shows "No results found" for "Runwal Elina" — a real residential complex in Mumbai. This means **both** Google Places and Nominatim are failing:

1. **Google Places API is likely returning `REQUEST_DENIED**` — the hardcoded API key (`AIzaSyDCeS7...`) almost certainly does not have the **Places API** enabled in Google Cloud Console, or billing is not active. The `getPlacePredictions` call silently returns zero results, and the existing `console.warn` only fires in the browser console (not visible to you in the screenshot).
2. **Nominatim can't find "Runwal Elina"** because it's a residential complex not well-indexed in OpenStreetMap. Nominatim is a geocoder for addresses/POIs in OSM data — it misses many Indian residential complexes and commercial landmarks.

### What will actually fix this

The Google API key issue is the #1 blocker. But since we can't guarantee the user will fix their Google Cloud Console setup, we need a **robust multi-fallback** approach:

#### 1. Add Google Geocoding API as a second fallback

The Geocoding API (`/maps/api/geocode/json`) is a **different API** from Places Autocomplete and is sometimes enabled when Places is not. It also handles partial place names well. Add it as a fallback between Google Places and Nominatim.

```text
Search order:
  Google Places Autocomplete → Google Geocoding API → Nominatim
```

#### 2. Add visible diagnostic feedback

When Google returns a non-OK status, show it in the dropdown (not just console) so the problem is immediately clear:

- `REQUEST_DENIED` → show "Google Places unavailable — check API key"
- `OVER_QUERY_LIMIT` → show "Search limit reached, try again shortly"

This replaces the generic "No results found" with actionable info.

#### 3. Improve Nominatim query for Indian landmarks

Add a structured search variant: when the free-text search returns nothing, retry with `amenity` + city name appended (e.g., "Runwal Elina Mumbai") to improve hit rate for landmarks not well-tagged in OSM.

#### 4. Surface Google API status on load

When the Places service initializes, do a test query (e.g., empty `getPlacePredictions` with just the session token) to detect `REQUEST_DENIED` early and warn the user that search quality may be degraded.

### Files Changed


| File                                | Change                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/hooks/usePlaceAutocomplete.ts` | Add Google Geocoding fallback; improve Nominatim retry with city context; surface API status in results |
| `src/pages/MapMyJourney.tsx`        | Show diagnostic message when Google API is denied; style degraded-search warning                        |


### Expected Result

- If Google Places API key works → fast, accurate Uber-like results
- If Google Places fails but Geocoding works → still good results via geocoding
- If both Google APIs fail → improved Nominatim with city-context retry
- In all cases → clear feedback about what's happening instead of silent "No results"

### Important Note for the User

For best results, you should ensure your Google Cloud Console project has:

1. **Places API** enabled
2. **Geocoding API** enabled
3. **Billing account** linked (required even for the free $200/month tier)

Without these, Google search will always fall back to the lower-quality Nominatim engine.  
  
