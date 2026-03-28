

# Uber-Like Real-Time Journey Tracker for Guardians

## Current State

- The ward's location is saved to `journey_updates` every **60 seconds**
- The guardian's `GuardianJourneyTracker` fetches updates on mount and listens via Supabase Realtime (`postgres_changes` on `journey_updates` INSERT)
- The map shows a static marker at the last known position with a polyline of the route trail
- No smooth animation, no heading/bearing indicator, no auto-panning

## What Changes

Transform the guardian's journey map into an Uber-style live tracker with:
1. **Smooth marker animation** — marker glides between positions instead of jumping
2. **Custom car/person icon** with heading/bearing rotation based on direction of travel
3. **Auto-pan map** to follow the ward's position as it moves
4. **Increase location save frequency** from 60s → **15s** during active journeys for near-real-time tracking
5. **Larger, more prominent map** (200px → 350px) with fullscreen toggle
6. **Live ETA countdown** updating every second
7. **Route path styling** — thicker animated dashed line showing the traveled path, faded line to destination
8. **Origin and destination markers** with distinct custom icons (green start pin, red destination flag)

## Technical Approach

### 1. Increase tracking frequency (`useJourneyTracker.ts`)
- Change `lastSaveTime` threshold from 60000ms → 15000ms (save location every 15s)
- This gives guardians ~4x more frequent position updates

### 2. Enable Supabase Realtime on `journey_updates` (migration)
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.journey_updates;` — required for the guardian to receive INSERT events in real time

### 3. Upgrade `GuardianJourneyTracker.tsx`
- **Animated marker**: Use `useRef` to store previous position; on new update, interpolate lat/lng over ~1s using `requestAnimationFrame` for smooth gliding
- **Directional icon**: Create a custom Leaflet `divIcon` with a rotated arrow/car SVG; compute bearing from previous → current position
- **Auto-pan**: Add a `PanToPosition` map child component that calls `map.panTo()` smoothly on each new position
- **Fullscreen toggle**: Button to expand map to fill the card
- **Live ETA**: A `useEffect` with 1s interval counting down `estimated_duration_min - elapsed`
- **Styled route**: Traveled path (solid blue), remaining path to destination (dashed gray)

### 4. Custom marker icons
- Ward's current position: Pulsing blue dot with directional arrow (CSS animation)
- Origin: Green circle marker
- Destination: Red flag/pin marker

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useJourneyTracker.ts` | Reduce save interval from 60s → 15s |
| `src/components/GuardianJourneyTracker.tsx` | Full rewrite: animated marker, auto-pan, directional icon, larger map, fullscreen, live ETA, styled route |
| Migration | Add `journey_updates` to Supabase Realtime publication |

## Limitations

- GPS accuracy depends on ward's device (typically 5-15m on mobile)
- Updates still depend on the ward's browser/PWA being active (background geolocation has browser limitations)
- Not true GPS streaming — it's periodic saves (every 15s) with smooth interpolation between points on the guardian side

