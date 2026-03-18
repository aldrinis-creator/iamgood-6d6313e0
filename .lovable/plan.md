

## Services Tab in My Health

### Overview
Create a `HealthServices` component that renders when the "Services" tile is selected. It provides a nearby hospital/pharmacy finder (using browser geolocation + Google Maps links) and an emergency contacts directory with common Indian emergency numbers.

### New Component: `src/components/HealthServices.tsx`

**Three sections:**

1. **Nearby Facilities** — Two cards: "Find Hospitals" and "Find Pharmacies". Each uses the browser's geolocation API to open Google Maps search (`https://www.google.com/maps/search/hospitals+near+me/` or `pharmacies+near+me`). Shows a location status indicator.

2. **Emergency Contacts Directory** — A list of essential Indian emergency numbers:
   - Police: 100
   - Ambulance: 108
   - Fire: 101
   - Women Helpline: 1091
   - Child Helpline: 1098
   - Mental Health: iCall 9152987821
   - Poison Control: 1800-11-6117
   
   Each row has a `tel:` link for one-tap dialing.

3. **Personal Emergency Contacts** — Pulls the user's guardians from the `guardians` table and displays them with call buttons. No new DB tables needed.

### Integration
- Update `src/pages/MyHealth.tsx`: import `HealthServices`, render when `selectedTool === "Services"`

### Files Changed
1. **`src/components/HealthServices.tsx`** — New component
2. **`src/pages/MyHealth.tsx`** — Wire up Services render

### No database or migration changes needed
Uses existing `guardians` table for personal contacts and external Google Maps for facility search.

