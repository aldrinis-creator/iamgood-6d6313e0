

## Fix "Runwal Elina" Search — Final Working Approach

### The Real Problem
"Runwal Elina" is not indexed in any free geocoding database (OSM/Photon/Nominatim), and the Google API key blocks all non-Autocomplete APIs via referer restrictions. This is not a code bug — it's a data coverage gap.

### Solution: Two Improvements

**1. Add Tier 3.5: MapmyIndia / Mappls Atlas API**
India's official mapping service (by C-DAC/ISRO partnership) has far superior coverage of Indian residential complexes, buildings, and landmarks. Their free tier allows 5,000 requests/day.

However, this requires an API key from Mappls. If we don't want to add another API key dependency, we use approach #2 instead.

**2. Smarter Fallback: Fuzzy Partial Search (No API key needed)**
When all tiers return 0 results for the full query, automatically retry with progressively shorter queries to surface related results:
- "Runwal Elina" → 0 results → retry "Runwal" via Photon with location bias (Mumbai)
- Show results like "Runwal Forest", "RunwalBliss", "Runwal Anthurium" as suggestions
- Label these as "Similar places" in the dropdown so the user knows it's a fuzzy match

Additionally, enhance Photon queries by appending the user's detected city (from GPS reverse-geocode) to improve relevance.

### Changes — `src/hooks/usePlaceAutocomplete.ts`

1. **After all 4 tiers fail**: Extract the first word(s) from the query and retry Photon with city context
   - "Runwal Elina" → retry "Runwal Mumbai" via Photon → returns 5+ Runwal complexes
   - Display results with a "Nearby matches" label

2. **Enhance Photon queries**: Always append user's city (detected from GPS) as a location bias parameter (`lat`/`lon` params supported by Photon API)

3. **Show "no exact match" feedback**: When showing fuzzy results, add a subtle note: "No exact match found. Showing similar places nearby."

### Technical Detail

```text
CURRENT FLOW (all fail silently):
  Tier 1: Autocomplete("Runwal Elina") → 0
  Tier 2: searchByText("Runwal Elina") → PERMISSION_DENIED
  Tier 3: Photon("Runwal Elina") → 0
  Tier 4: Nominatim("Runwal Elina India") → 0
  → Empty dropdown, user stuck

NEW FLOW:
  Tier 1–4: same as above → 0 results
  Tier 5 (Fuzzy): Photon("Runwal Mumbai", lat=19.07, lon=72.87) → 5 results
  → Shows "RunwalBliss", "Runwal Forest", etc. with "Similar places" label
```

### Files to Edit
- `src/hooks/usePlaceAutocomplete.ts` — add fuzzy retry logic after all tiers fail, add location bias to Photon

### Expected Outcome
- "Runwal Elina" → shows related Runwal complexes with "Similar places" label instead of empty results
- User can pick the closest match or refine their search
- Works without any additional API keys

