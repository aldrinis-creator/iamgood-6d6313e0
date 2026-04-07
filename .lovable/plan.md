

## MMJ Improvements: Google Maps, Deferred Map, Overlay Pop-ups, and Journey Reports

### Overview
Four changes to Map My Journey across both user and guardian apps.

---

### 1. Guardian App: Use Google Maps for MMJ Tracker

**Current**: `GuardianJourneyTracker.tsx` already uses Google raster tiles (`mt1.google.com/vt/lyrs=m`) via Leaflet — this is already Google Maps tiles.

**Change**: No change needed for map tiles. The guardian tracker already renders Google Maps.

---

### 2. User App: Show Map Only After Destination Selected

**Current**: `MapMyJourney.tsx` lines 607-624 always render the map preview when `originPos` is available, even before a destination is chosen.

**Change**: Wrap the map preview block so it only renders when `selectedDest` is truthy (destination has been selected and route fetched).

| File | Change |
|------|--------|
| `src/pages/MapMyJourney.tsx` | Change line 607 condition from `{originPos && (` to `{originPos && selectedDest && routeCoords.length > 0 && (` |

---

### 3. Pop-ups Display Over Map / Current View

**Current**: `JourneyCheckInPopup` uses Radix `Dialog` which renders in a portal with an overlay — this already appears over the map. However, other alerts (arriving soon, route deviation) are inline badges, not actionable pop-ups.

**Changes**:
- The journey check-in popup already overlays the map correctly via `Dialog`. No change needed there.
- Add a new **alert overlay** component for route deviation and arriving-soon alerts that renders as a fixed overlay (similar to `ReminderOverlay`) with an action button (e.g., "OK" / "Acknowledged") that dismisses the alert.
- Wire `useJourneyTracker` to emit these alerts as state, and render the overlay in `MapMyJourney.tsx` on top of the map.

| File | Change |
|------|--------|
| `src/components/JourneyAlertOverlay.tsx` | New component: fixed overlay with alert message + dismiss button |
| `src/pages/MapMyJourney.tsx` | Render `JourneyAlertOverlay` for arrivingSoon / routeDeviation with dismiss callbacks |
| `src/hooks/useJourneyTracker.ts` | Add `arrivingSoonDismissed` and `routeDeviationDismissed` state so alerts show once and can be dismissed |

---

### 4. Journey Completion Report

When a journey ends (manual or auto), generate a summary report with:
- Date/time stamp (start and end)
- Total distance traveled (sum of haversine segments between GPS updates)
- Total journey time
- Break duration (gaps > 2 min between consecutive GPS updates where distance < 20m)
- Route deviation events (count, max deviation in meters — from notifications or tracked state)

**Storage**: Add a `journey_reports` table to persist the report data so both user and guardian can view it.

**User view**: Show past journey reports in a new section on the MMJ page (below the setup form when no active journey).

**Guardian view**: Add a "Journeys" tab/section to `GuardianReports.tsx` showing completed journey reports for the selected ward.

#### Database Migration

```sql
CREATE TABLE public.journey_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  origin_name text,
  destination_name text NOT NULL,
  transport_mode text,
  total_distance_m numeric NOT NULL DEFAULT 0,
  total_duration_min numeric NOT NULL DEFAULT 0,
  break_duration_min numeric NOT NULL DEFAULT 0,
  deviation_count integer NOT NULL DEFAULT 0,
  max_deviation_m numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own journey_reports" ON public.journey_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journey_reports" ON public.journey_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Guardians can view ward journey_reports" ON public.journey_reports
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = journey_reports.user_id)
  );
```

#### Report Generation

| File | Change |
|------|--------|
| `src/hooks/useJourneyTracker.ts` | In `endJourney()`, compute report metrics from `updates` array (distance, breaks, deviations) and insert into `journey_reports`. Track deviation count/max during journey. |
| `src/pages/MapMyJourney.tsx` | When no active journey, fetch and display past `journey_reports` as a list of cards with date, distance, time, breaks, deviations. |
| `src/pages/GuardianReports.tsx` | Add a "journeys" section to the report tabs. Fetch `journey_reports` for the selected ward and display them similarly. |

#### Report Card UI (shared between user and guardian)

| File | Change |
|------|--------|
| `src/components/JourneyReportCard.tsx` | New component displaying a single journey report: date/time, distance, duration, break time, deviation info. Reusable in both MMJ and Guardian Reports. |

---

### Files Changed Summary

| File | Action |
|------|--------|
| `src/pages/MapMyJourney.tsx` | Defer map until destination selected; add alert overlay; add journey history section |
| `src/hooks/useJourneyTracker.ts` | Track deviation metrics; generate report on journey end; add alert dismiss state |
| `src/components/JourneyAlertOverlay.tsx` | New: fixed overlay for journey alerts with dismiss |
| `src/components/JourneyReportCard.tsx` | New: reusable journey report card |
| `src/pages/GuardianReports.tsx` | Add "Journeys" tab with journey report cards |
| Database migration | New `journey_reports` table with RLS |

