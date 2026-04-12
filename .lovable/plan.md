

## Auto-Populate Locations in Safe Zone Editor

### What changes

Currently, when adding a safe zone, the only way to set a location is "Use Current Location" via GPS. The user wants quick-pick suggestions from their saved destinations (Home, Work, favorites from Map My Journey) and place search.

### Approach

**Modify `src/components/SafeZoneEditor.tsx`** to:

1. **Show saved destination chips** — Import `useSavedDestinations` hook. When the add form opens, display clickable chips for Home, Work, and other saved/favorite destinations. Clicking one auto-fills the name and lat/lng coordinates instantly (no GPS wait needed).

2. **Add place search input** — Add an address search field using the `usePlaceAutocomplete` hook (already built for Map My Journey). User types an address, selects from dropdown, coordinates resolve automatically.

3. **Keep GPS as fallback** — "Use Current Location" button remains available below the suggestions.

### UI Flow

When user clicks "Add Safe Zone":
- Show the name input (pre-filled if a suggestion is picked)
- Show a row of quick-pick buttons: 🏠 Home, 🏢 Work, plus any favorited saved destinations
- Show an address search input with autocomplete dropdown
- Show "Use Current Location" as a secondary option
- Once location is set (by any method), show the map preview and radius slider as before

### Files to modify

| File | Change |
|------|--------|
| `src/components/SafeZoneEditor.tsx` | Import `useSavedDestinations` and `usePlaceAutocomplete`. Add quick-pick chips for saved destinations, add address search with autocomplete dropdown, restructure the add form to show all three location methods |

### No database or edge function changes needed

