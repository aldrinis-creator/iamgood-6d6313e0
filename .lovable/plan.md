

# Google Street View Integration for Journey Maps

## Overview

Add a toggleable Google Street View panel to both the ward's Map My Journey page and the guardian's journey tracker, showing 3D street-level imagery at the ward's current position.

## Prerequisites

You'll need a **Google Maps API key** with these APIs enabled:
- Maps JavaScript API
- Street View Static API (or Street View JavaScript API)

Google provides $200/month free credit (~28,000 Street View loads). You'll need to:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable "Maps JavaScript API" and "Street View API"
4. Create an API key under Credentials
5. Provide the key when prompted by Lovable

## What Changes

1. **Street View toggle button** on both maps — tap to split the view into map + Street View panel
2. **Street View panel** renders below the map showing the 3D street-level view at the ward's current GPS position
3. **Auto-updates** — as the ward moves, the Street View heading rotates to match travel direction
4. The existing Leaflet/OSM map stays unchanged; Street View is an additive overlay

## Technical Approach

### 1. Load Google Maps JS API
- Add a utility that dynamically loads the Google Maps script using the API key (stored as a secret)
- The key will be a **public/publishable** key (restricted by HTTP referrer), so it can be stored in code via `VITE_GOOGLE_MAPS_API_KEY`

### 2. Create `StreetViewPanel` component
- A reusable component that takes `lat`, `lng`, `heading` props
- Renders a `div` and initializes `google.maps.StreetViewPanorama` on mount
- Updates position/heading when props change
- Shows a "No Street View available" fallback if coverage is missing

### 3. Integrate into MapMyJourney.tsx
- Add a toggle button (e.g., "Street View" with an icon)
- When active, render `StreetViewPanel` below the map with the ward's current position
- Heading computed from travel bearing

### 4. Integrate into GuardianJourneyTracker.tsx
- Same toggle button and `StreetViewPanel`
- Position updates as the ward moves; heading follows the animated marker's bearing

## Files Changed

| File | Change |
|------|--------|
| `src/components/StreetViewPanel.tsx` | New — reusable Street View component |
| `src/lib/googleMaps.ts` | New — dynamic Google Maps script loader |
| `src/pages/MapMyJourney.tsx` | Add Street View toggle + panel |
| `src/components/GuardianJourneyTracker.tsx` | Add Street View toggle + panel |

## Secret Required

`VITE_GOOGLE_MAPS_API_KEY` — publishable client-side key, stored in codebase (safe since it's restricted by referrer).

