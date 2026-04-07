

## Fix MMJ Destination Search Freezing

### Root Cause Analysis

After reviewing the code, there are several issues causing the destination search to freeze and not populate:

1. **No request cancellation**: Each keystroke fires a new Nominatim fetch after 300ms, but previous in-flight requests are never aborted. Stale responses can overwrite newer results or pile up, causing UI jank.

2. **No fetch timeout**: The Nominatim API call has no timeout — if the server is slow or rate-limiting (common with Nominatim's usage policy), the request hangs indefinitely with no feedback.

3. **Cached failed Google Maps promise**: In `googleMaps.ts`, if `loadGoogleMapsAPI()` fails, the rejected promise is cached in `loadPromise` and never retried. Every subsequent call immediately rejects, permanently breaking the Google Places fallback.

4. **No loading indicator**: Users see no visual feedback while search results are being fetched, making it appear frozen.

5. **Race conditions**: Without an abort mechanism, a slow response from search #1 can arrive after search #2's response and overwrite the correct results.

### Plan

#### 1. Add AbortController to destination search (`MapMyJourney.tsx`)

- Store an `AbortController` ref that gets aborted on each new search call
- Pass `signal` to the Nominatim `fetch()` call
- Add a 5-second timeout using `AbortSignal.timeout(5000)` combined with the user abort signal
- Add a `searching` state boolean to show a spinner in the input field
- Catch `AbortError` silently (expected behavior)

#### 2. Fix cached failed promise (`googleMaps.ts`)

- Reset `loadPromise = null` inside the `.onerror` handler so the next call retries loading

#### 3. Add search loading indicator (`MapMyJourney.tsx`)

- Show a small spinner inside the input when `searching` is true
- Show "No results found" message when search completes with empty results

#### 4. Add explicit timeout to Google Places fallback (`MapMyJourney.tsx`)

- Wrap the `getPlacePredictions` callback in a timeout so it doesn't hang indefinitely

### Files Changed

| File | Change |
|------|--------|
| `src/lib/googleMaps.ts` | Reset `loadPromise` on failure so retries work |
| `src/pages/MapMyJourney.tsx` | Add AbortController, fetch timeout, searching state, loading UI, race condition fix |

