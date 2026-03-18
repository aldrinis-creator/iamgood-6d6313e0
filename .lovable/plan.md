

## Wire SOS Button to Real Database with GPS

### Current State
- `triggerSOS` and `cancelSOS` just toggle local `emergencyMode` boolean
- `EmergencyModeOverlay` shows a countdown, then displays "Alert Sent" — but nothing is persisted
- `sos_events` table already exists with `user_id`, `latitude`, `longitude`, `status`, `trigger_type`, `triggered_at`, `cancelled_at`, `resolved_at`

### Changes

**1. Update `AppContext.tsx`**
- `triggerSOS` becomes async: requests GPS via `navigator.geolocation.getCurrentPosition()`, then inserts a row into `sos_events` with `user_id`, `latitude`, `longitude`, `trigger_type: 'manual'`, `status: 'active'`
- Store the created SOS event ID in state (`activeSosId`)
- `cancelSOS` updates the active `sos_events` row: sets `status: 'cancelled'`, `cancelled_at: now()`
- Expose `activeSosId` so the overlay can reference it
- Handle GPS permission denied gracefully — still create the SOS event but with null coordinates, show a toast warning

**2. Update `EmergencyModeOverlay.tsx`**
- When countdown reaches 0, the SOS event is already inserted (it was created on trigger). No additional action needed at countdown end.
- "I'm Safe — Cancel Alert" calls `cancelSOS` which updates the DB row
- "Call 112" button triggers `tel:112` link
- "Share Location" button could re-fetch and display current coordinates (or open maps)

**3. Files modified**
- `src/contexts/AppContext.tsx` — add Supabase insert/update for SOS events + geolocation
- `src/components/EmergencyModeOverlay.tsx` — wire Call 112 to `tel:112`, minor tweaks

No database or migration changes needed — `sos_events` table and RLS policies already exist.

