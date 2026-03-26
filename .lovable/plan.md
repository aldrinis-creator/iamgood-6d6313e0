

# Map My Journey (MMJ) — Feature Plan

## Overview

A journey-tracking feature that lets a User share their real-time travel with their Guardian. The User starts a journey (destination + transport mode), and the Guardian tracks it on a live map. Periodic "Are you OK?" check-ins happen during the journey. Both parties are notified as the destination approaches, and the journey auto-closes if not manually ended.

## User Flow

```text
USER                                         GUARDIAN
──────                                       ────────
1. Tap "Map My Journey"
2. Enter destination (autocomplete)
3. Select transport mode
4. See route + ETA on map
5. Tap "Start Journey"
   ──── notification ──────────────────────► "User started a journey to X"
6. Location tracked every 60s              ► Live map with route + user dot
7. Every 15min (<1h) or 30min (>1h):
   "Are you OK?" popup → respond
   ──── status update ────────────────────► Sees health/status updates
8. Approaching destination:
   "Arriving soon" alert                   ► "User arriving soon" alert
9. Tap "End Journey" (or auto-end 10min)
   ──── notification ──────────────────────► "Journey completed safely"
```

## Technical Plan

### 1. New Database Table: `journeys`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | NOT NULL |
| destination_name | text | NOT NULL |
| destination_lat | float | NOT NULL |
| destination_lng | float | NOT NULL |
| origin_name | text | |
| origin_lat | float | |
| origin_lng | float | |
| transport_mode | text | walk/car/bus/train/auto |
| estimated_duration_min | int | |
| status | text | active/completed/auto_completed |
| started_at | timestamptz | DEFAULT now() |
| ended_at | timestamptz | |
| created_at | timestamptz | DEFAULT now() |

RLS: User CRUD own rows. Guardians SELECT via guardians join.

### 2. New Database Table: `journey_updates`

Stores periodic location + check-in responses during a journey.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| journey_id | uuid | FK to journeys |
| user_id | uuid | NOT NULL |
| lat | float | |
| lng | float | |
| check_in_response | text | null if just a location ping |
| created_at | timestamptz | DEFAULT now() |

RLS: User INSERT/SELECT own. Guardians SELECT via guardians join. Enable realtime.

### 3. New Components (User Side)

**`src/pages/MapMyJourney.tsx`** — Main page
- Destination input with autocomplete (using OpenStreetMap Nominatim — free, no API key)
- Transport mode selector (walk/car/bus/train/auto-rickshaw)
- Route display using Leaflet + OSRM (free routing)
- ETA calculation from OSRM response
- "Start Journey" / "End Journey" button
- Active journey status card with elapsed time and distance remaining

**`src/hooks/useJourneyTracker.ts`** — Core tracking hook
- When journey active: `watchPosition` for continuous GPS
- Saves location to `journey_updates` every 60s
- Calculates distance-to-destination; triggers "arriving soon" when <500m
- Schedules "Are you OK?" popups (15min if ETA <1h, else 30min)
- Auto-ends journey 10min after arriving within destination radius (~200m)
- Notifies guardians at start, during check-ins, approaching, and end

**`src/components/JourneyCheckInPopup.tsx`** — Periodic popup
- "Are you OK?" with preset responses ("I'm fine", "Feeling tired", "Need a break") + free text
- Response saved to `journey_updates.check_in_response`
- Notifies guardian of response

### 4. New Components (Guardian Side)

**`src/components/GuardianJourneyTracker.tsx`** — Live map card on Guardian Dashboard
- Shows when ward has an active journey
- Leaflet map with: origin marker, destination marker, route polyline, live user position dot
- Journey progress bar (distance covered / total)
- List of check-in responses with timestamps
- "Arriving soon" and "Journey completed" alerts

### 5. Integration Points

**`src/pages/UserDashboard.tsx`** — Add "Map My Journey" quick-action card
**`src/components/NavTabs.tsx`** — No change (accessed from dashboard)
**`src/pages/GuardianDashboard.tsx`** — Add `GuardianJourneyTracker` when active journey exists
**`src/App.tsx`** — Add `/journey` route (UserRoute)
**Notifications** — Insert into `notifications` table for guardian alerts

### 6. Dependencies

- **Leaflet + react-leaflet** — Map rendering (free, no API key)
- **OpenStreetMap Nominatim API** — Destination autocomplete (free, rate-limited)
- **OSRM** — Route calculation + ETA (free public API)

No paid APIs or new secrets required.

### 7. Files Summary

| File | Change |
|------|--------|
| DB migration | Create `journeys` + `journey_updates` tables with RLS |
| `src/pages/MapMyJourney.tsx` | New — journey setup + active tracking page |
| `src/hooks/useJourneyTracker.ts` | New — GPS tracking, check-in scheduling, auto-end |
| `src/components/JourneyCheckInPopup.tsx` | New — periodic "Are you OK?" popup |
| `src/components/GuardianJourneyTracker.tsx` | New — live map + updates for guardian |
| `src/pages/UserDashboard.tsx` | Add MMJ quick-action card |
| `src/pages/GuardianDashboard.tsx` | Add journey tracker component |
| `src/App.tsx` | Add `/journey` route |

