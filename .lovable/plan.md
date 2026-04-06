

## Fix: Destination Auto-population and Home/Work Quick-set in MMJ

### Problem Analysis

1. **No auto-population on focus**: When the destination input is focused with no text, the dropdown only shows saved destinations (`savedDests`). If the user has no saved destinations yet, nothing appears — feels broken. Need to show nearby/popular places automatically.

2. **Set Home/Work unresponsive**: When "Set Home" or "Set Work" is tapped with no destination selected and no existing home/work saved, only a toast appears ("Search for a destination first"). This is easily missed and feels like the app is frozen. Need a more interactive flow.

### Plan

**File: `src/pages/MapMyJourney.tsx`**

**Fix 1 — Auto-populate nearby places on focus**
- When input is focused and empty, if there are no saved destinations, automatically trigger a Google Places nearby search using the user's `originPos`
- Use `AutocompleteService.getPlacePredictions` with a short generic query (e.g., empty string won't work, so use the Places API `nearbySearch` or just show a "Type to search" prompt with popular category chips like "Restaurant", "Hospital", "Mall")
- Simpler approach: lower the search threshold to 1 character, and when input is focused with no text and no saved dests, show placeholder suggestions by querying popular nearby POIs via `textSearch` or just display category quick-filter chips (Food, Hospital, Shopping, Station) that auto-fill the search

**Recommended approach**: When input is focused and empty with no saved destinations, show quick-category chips (Home, Work, Restaurant, Hospital, Mall, Station). Tapping a chip fills the search with that term and triggers autocomplete. This gives immediate interactivity without requiring a separate API.

**Fix 2 — Home/Work button behavior**
- When "Set Home" or "Set Work" is tapped and neither home/work is saved nor a destination is selected:
  - Focus the destination input
  - Set a `pendingHomeWork` state (`"home" | "work" | null`)
  - Show a visual indicator on the input: "Search to set as Home" / "Search to set as Work"
  - When user then selects a destination from search results, automatically save it as Home/Work using `setHomeWork`, clear the `pendingHomeWork` state, and show success toast

### Files to modify
- `src/pages/MapMyJourney.tsx` — add category chips for empty state, add `pendingHomeWork` flow for Set Home/Work buttons

### Technical details
- New state: `pendingHomeWork: "home" | "work" | null`
- Category chips array: `[{label: "Restaurant", icon: ...}, {label: "Hospital"}, ...]`
- Chip tap fills destination input text and calls `searchDestination(chipLabel)`
- In `handleSelectDest`, check `pendingHomeWork` — if set, call `setHomeWork(type, dest)` and clear it
- Add `inputRef` to programmatically focus the input when Set Home/Work is tapped without a destination
- Update input placeholder dynamically when `pendingHomeWork` is active

