

## Multi-fix Plan: Home/Work Quick-set, Guardian Map Enlarge, Google Maps Migration, and Frozen Destination Fix

### Problem Analysis

1. **Frozen destination input**: The `onBlur` handler uses `setTimeout(() => setInputFocused(false), 200)` which races with click handlers on the dropdown. When Google Places API loads slowly or errors, the input may appear unresponsive. Additionally, the `locationBias` type cast may cause runtime errors in some Google API versions.

2. **OpenStreetMap tiles still used everywhere**: Five files use OSM tile layers or embeds instead of Google Maps.

3. **No Home/Work quick-set**: Users must search every time for frequent locations.

4. **Guardian location map not enlargeable**: The ward location on `GuardianDashboard.tsx` is a fixed 192px OSM iframe with no expand option.

---

### Step 1 — Fix frozen destination input in MMJ

**File: `src/pages/MapMyJourney.tsx`**
- Increase `onBlur` timeout from 200ms to 300ms to prevent race with click handlers
- Add a `mouseDown` handler on dropdown items using `onMouseDown` (fires before `onBlur`) instead of relying solely on `onClick`
- Guard against `autocompleteService.current` being null more defensively
- Add a clear button (X) to reset destination when text is present

### Step 2 — Add Home & Work quick-set feature

**File: `src/hooks/useSavedDestinations.ts`**
- Add a `label` concept: extend the hook to support `setHomeWork(type: "home" | "work", dest)` and `getHomeWork(type)`
- Store Home/Work as special saved destinations with `is_favorite = true` and a convention: name prefixed with `🏠 Home:` or `🏢 Work:`

**File: `src/pages/MapMyJourney.tsx`**
- Add two quick-tap buttons (Home / Work) above the destination input
- If Home/Work is set, tapping selects it immediately as destination
- If not set, show a prompt to save current search result as Home/Work
- Add a "Set as Home" / "Set as Work" option in the saved destinations dropdown

**Database**: No schema changes needed — reuse `saved_destinations` table with name convention.

### Step 3 — Replace all OpenStreetMap with Google Maps tiles

Replace OSM tile URLs with Google Maps tile layer across all files. Since we already load the Google Maps JS API, use Google's raster tile endpoint or embed API.

**Files to update:**
- `src/pages/MapMyJourney.tsx` (2 TileLayer instances) — swap OSM URL to Google Maps tiles
- `src/components/GuardianJourneyTracker.tsx` (1 TileLayer) — swap OSM URL
- `src/components/NearbyFacilities.tsx` (1 L.tileLayer call) — swap OSM URL
- `src/pages/GuardianDashboard.tsx` (1 iframe embed) — replace OSM iframe with Google Maps static/embed API using the existing API key

Google Maps tile URL pattern:
```
https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}
```
This works directly with Leaflet's TileLayer — no library swap needed.

### Step 4 — Add enlarge option to Guardian location map

**File: `src/pages/GuardianDashboard.tsx`**
- Replace the OSM iframe with a proper Google Maps embed using the API key
- Add an expand/collapse button (Maximize2/Minimize2 icons) that toggles the map height between 192px and 400px
- Add a "View in Google Maps" external link button

---

### Files to modify
- `src/pages/MapMyJourney.tsx` — fix frozen input, add Home/Work buttons, swap tiles
- `src/hooks/useSavedDestinations.ts` — add Home/Work save/get methods
- `src/components/GuardianJourneyTracker.tsx` — swap tiles
- `src/components/NearbyFacilities.tsx` — swap tiles  
- `src/pages/GuardianDashboard.tsx` — swap embed, add enlarge

### Technical details
- Google Maps raster tiles via `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}` are compatible with Leaflet TileLayer
- Home/Work stored as saved destinations with name prefix convention — no DB migration required
- Frozen input fix uses `onMouseDown` + `preventDefault()` pattern to prevent blur before click registers

