

## Fix: Destination Search Not Populating in Map My Journey

### Root Cause

The Google Maps API key (`AIzaSyDCeS7oubdcbYDt46e1vXeP3vrfLJGaOCw`) likely has the Places API disabled or is quota-exhausted. The script loads successfully (so `autocompleteService.current` gets set), but `getPlacePredictions` returns a non-OK status like `REQUEST_DENIED` or `OVER_QUERY_LIMIT`.

The Nominatim fallback *does* fire in this case (line 163-167), but it may also fail silently due to Nominatim's strict rate limiting and User-Agent requirements, or the `fetch` may be blocked by CSP in the preview environment.

The core problem: the search depends on two unreliable external APIs with no visible error feedback to the user.

### Fix

**File: `src/pages/MapMyJourney.tsx`** — Rewrite `searchDestination` to use **Nominatim as primary** search and Google Places as an optional enhancement. This removes dependency on the potentially broken API key for the core search flow.

1. **Make Nominatim the primary search** — call it directly without waiting for Google API
2. **Add error visibility** — if both APIs fail, show a toast so the user knows something went wrong instead of silent failure
3. **Remove the `autocompleteService.current` gate** — the current logic only falls back to Nominatim if Google isn't loaded; if Google IS loaded but returns errors, the fallback fires but may also fail silently
4. **Add `countrycode=in` to Nominatim** — since this is an India-focused app, this improves result relevance and avoids ambiguous matches

The rewritten search function (lines 128-171):
```typescript
const searchDestination = useCallback((query: string) => {
  if (searchTimer.current) clearTimeout(searchTimer.current);
  if (query.length < 1) { setSearchResults([]); return; }
  
  searchTimer.current = setTimeout(async () => {
    // Primary: Nominatim (reliable, no API key needed)
    try {
      const params = new URLSearchParams({
        format: "json", q: query, limit: "8", countrycodes: "in"
      });
      if (originPos) {
        params.set("lat", String(originPos.lat));
        params.set("lon", String(originPos.lng));
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, 
        { headers: { "User-Agent": "CheckiN-App/1.0" } });
      const data = await res.json();
      if (data.length > 0) {
        setSearchResults(data.map((d: any) => ({
          place_id: d.place_id?.toString() || String(Math.random()),
          description: d.display_name,
          main_text: d.display_name.split(",")[0],
          secondary_text: d.display_name.split(",").slice(1, 3).join(",").trim(),
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        })));
        return;
      }
    } catch (e) { console.warn("[MMJ] Nominatim search failed:", e); }

    // Fallback: Google Places (if loaded)
    if (autocompleteService.current) {
      // ... existing Google Places logic as secondary fallback
    }
    
    // If both fail, inform user
    if (searchResults.length === 0) {
      toast.error("Could not find destinations. Try a different search.");
    }
  }, 300);
}, [originPos]);
```

5. Since results from Nominatim always include `lat`/`lng`, `handleSelectDest` will use the direct path (line 214-216) without needing `PlacesService.getDetails` — eliminating another potential failure point.

### Files to modify
- `src/pages/MapMyJourney.tsx` — rewrite `searchDestination` function (lines 128-171)

