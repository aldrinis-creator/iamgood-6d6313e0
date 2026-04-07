

## Fix "Runwal Elina" Not Found

### Root Cause

The 4-tier chain runs **sequentially** — each tier waits for the previous one to complete and return zero results before trying the next. With the 180ms debounce plus network latency, typing additional characters can abort the entire chain before Tier 2 (Text Search) even executes. Additionally, appending `" India"` to the Text Search query may dilute results for specific building names.

### Fix

**File: `src/hooks/usePlaceAutocomplete.ts`**

1. **Run Tier 1 + Tier 2 in parallel** — Fire both Google Autocomplete and Text Search simultaneously. Merge results, preferring Autocomplete when it returns hits. This ensures Text Search always gets a chance to run, even for queries where Autocomplete returns ZERO_RESULTS.

2. **Remove `" India"` suffix from Text Search query** — Use location bias (origin lat/lng + radius) instead. Appending "India" can cause Google to miss specific building names like "Runwal Elina".

3. **Only fall to Tier 3/4 if both Tier 1+2 returned nothing** — Keep Geocoding and Nominatim as sequential fallbacks.

### Code Change Summary

```text
BEFORE:  Tier 1 → wait → Tier 2 → wait → Tier 3 → wait → Tier 4
AFTER:   [Tier 1 + Tier 2] parallel → wait → Tier 3 → wait → Tier 4
```

- In `textSearch`: change `query + " India"` → just `query`
- In `search`: replace sequential Tier 1 then Tier 2 with `Promise.all([googleSearch, textSearch])`, then merge/deduplicate results (Autocomplete results first, then Text Search results not already present)
- Keep Tier 3 (Geocoding) and Tier 4 (Nominatim) as sequential fallbacks only when parallel tiers return nothing

