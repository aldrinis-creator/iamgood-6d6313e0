

## Fix "Runwal Elina" Not Found in MMJ Search

### Why It Fails

The map tiles being OpenStreetMap is **not** the issue — OSM is only the visual map layer. The search uses Google APIs first. Here's what's happening for "Runwal Elina":

1. **Tier 1 (Google Places Autocomplete)** — Returns `ZERO_RESULTS` (not an error, so no console log). Google Places Autocomplete is optimized for businesses/POIs and often misses residential complexes.
2. **Tier 2 (Google Geocoding API)** — Also returns nothing. The Geocoding API expects **addresses**, not place/building names. "Runwal Elina" is a name, not an address.
3. **Tier 3 (Nominatim)** — OpenStreetMap doesn't have this complex indexed.

"Fortis Hospital" works because it's a well-known business/POI in Google's database.

### Fix: Add Google Text Search as Tier 2

Replace the Geocoding fallback with the **Google Places Text Search** endpoint (`places/findplacefromtext` or `place/textsearch`), which is designed for **place names** (not just addresses). This API finds residential complexes, buildings, and landmarks that Autocomplete misses.

Additionally, add `console.log` statements at each tier so failures are diagnosable.

### Changes

| File | Change |
|------|--------|
| `src/hooks/usePlaceAutocomplete.ts` | Replace Geocoding tier with **Google Text Search** (`/maps/api/place/textsearch/json`) using the Places API key; add diagnostic `console.log` at each tier showing tier name, query, and result count |

### Technical Detail

```typescript
// Tier 2: Google Places Text Search (finds building names, not just addresses)
const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_KEY}&region=in`;
// With location bias:
// &location=19.07,72.87&radius=50000
```

This uses the **same Places API key** that's already configured and billing-enabled. Text Search is part of the Places API, so no additional API enablement is needed.

### Expected Result

- "Fortis Hospital" → found via Tier 1 (Google Autocomplete) ✓
- "Runwal Elina" → found via Tier 2 (Google Text Search) ✓
- Obscure locations → found via Tier 3 (Nominatim with city context) ✓
- Console logs show which tier returned results for debugging

### Important Note

The Google Places Text Search API has a cost of ~$32 per 1,000 requests (vs $2.83 for Autocomplete). It's only called as a fallback when Autocomplete returns zero results, so cost impact is minimal.

