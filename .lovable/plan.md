

## Recommendation: Keep Current Custom Implementation

### Why NOT to adopt `use-places-autocomplete`

The `use-places-autocomplete` npm package is essentially a wrapper around the **same Google Places Autocomplete API** already used in your Tier 1. It would **not** fix the "Runwal Elina" problem — that query fails at the Autocomplete level regardless of wrapper.

Your current custom `usePlaceAutocomplete` hook is **more capable** because it has a 4-tier fallback chain:

```text
Tier 1: Google Autocomplete  ← same as what the npm package does
Tier 2: Google Text Search    ← finds buildings/landmarks by name
Tier 3: Google Geocoding      ← address-based lookup
Tier 4: Nominatim (OSM)       ← free fallback
```

Adopting the npm package would mean losing Tiers 2–4 and going backward.

### What I Suggest Instead

The real question is: **does "Runwal Elina" work now with the Text Search tier we just added?** That's what needs testing. If it still fails, the issue is likely:

1. **CORS blocking** the Text Search JS SDK call (unlikely since it uses the loaded SDK, not REST)
2. The Places API key doesn't have the **Places API (New)** or **Places API** enabled for Text Search specifically

### Recommended Next Step

Test the search in the live preview for "Runwal Elina" and check the browser console for `[PlaceSearch]` logs. The logs will show exactly which tier was attempted and what status was returned — that tells us precisely what to fix next.

No code changes needed right now.

