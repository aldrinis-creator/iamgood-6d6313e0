

# Wearable Data Integration — Feasibility & Plan

## Current State
Activity, Face Scan, and Vitals data is collected via:
- Phone sensors (accelerometer for steps/HR estimation)
- Camera PPG (face scan heart rate, stress)
- Manual entry (activity logs)

## Wearable Integration Options

Since Check-iN is a **web app (PWA)**, direct Bluetooth/SDK access to wearables is limited. Here are the practical approaches:

### Option A: Google Fit / Apple Health via Edge Function (Recommended)
- User authorizes Google Fit (OAuth) → edge function fetches steps, HR, SpO2, sleep via REST API
- Works for Fitbit, Wear OS, Pixel Watch, Samsung (via Google Fit sync)
- Apple Health has no REST API — would need a companion native app or manual CSV export

### Option B: Manual CSV/JSON Import
- Let users export data from their wearable app and upload it
- Parse common formats (Fitbit CSV, Samsung Health export, Apple Health XML)
- Map to existing `activity_logs` columns

### Option C: Web Bluetooth API (Limited)
- Connects to BLE heart rate monitors, pulse oximeters
- Works only in Chrome/Edge desktop and Android Chrome
- Not supported on iOS Safari at all

## Recommended Plan

### Phase 1: Google Fit Integration
**Files:** New edge function `supabase/functions/sync-google-fit/index.ts`, new component `src/components/WearableSync.tsx`, settings UI update

1. **Google Fit connector** — use the OAuth flow via a backend edge function to fetch daily summaries (steps, HR, calories, sleep, SpO2)
2. **Sync button** in Activity Tracker and Vitals Monitor — "Import from Google Fit"
3. **Auto-merge** — upsert into `activity_logs` with `source: "google_fit"` column to distinguish from manual/sensor data
4. **Settings toggle** — enable/disable daily auto-sync

### Phase 2: Manual Wearable Data Import
**File:** New component `src/components/WearableImport.tsx`

1. Upload CSV/JSON from Fitbit, Samsung Health, or generic format
2. Parse and preview data before importing
3. Map columns to `activity_logs` fields
4. Bulk insert with `source: "import"`

### Database Change
Add a `source` column to `activity_logs`:
```sql
ALTER TABLE activity_logs ADD COLUMN source text NOT NULL DEFAULT 'manual';
```
Values: `manual`, `sensor`, `google_fit`, `import`

## Technical Constraints
- **Apple Health**: No web API. Cannot integrate without a native iOS app. Best we can do is CSV import from the Health app's export feature.
- **Web Bluetooth**: iOS doesn't support it at all. Android Chrome does but UX is clunky. Not recommended as primary path.
- **Google Fit API**: Being deprecated in favor of Health Connect (Android-only SDK). The REST API still works but has a sunset timeline — worth monitoring.

## Recommendation
Start with **Phase 2 (Manual Import)** since it works universally and requires no OAuth setup. Then add **Google Fit** when you're ready to set up OAuth credentials. This gives users with any wearable brand a way to get their data in immediately.

## Files Changed
- `supabase/functions/sync-google-fit/index.ts` (Phase 1)
- `src/components/WearableImport.tsx` (Phase 2)
- `src/components/WearableSync.tsx` (Phase 1)
- `src/components/ActivityTracker.tsx` — add import/sync buttons
- `src/components/VitalsMonitor.tsx` — show wearable data source badge
- Migration: add `source` column to `activity_logs`

