# SOS: 30-second countdown everywhere + fix missed check-in auto-SOS

## Findings
- The countdowns aren't the same everywhere today: manual SOS is 10s, fall detection is 15s, and the journey "Are you OK?" screen is 60s.
- **The missed check-in auto-SOS has never fired.** The nightly check (every 10 min) tries to save the SOS with type "auto", but the database only accepts `manual`, `fall_detection`, `inactivity`, `missed_checkin`. The insert fails quietly and gets logged. All 41 SOS events on record are manual. Guardians still get the separate missed check-in WhatsApp, push and email.

## Changes
1. **30-second countdown on every SOS screen**
   - Manual SOS (SOSDialog): 10 → 30s, including the progress bar and reset values.
   - Fall detection: 15 → 30s (hook constant, plus the overlay's progress bar, which currently hardcodes 15).
   - Journey auto-SOS overlay: 60 → 30s.
   - Nothing else about the flow changes: cancel buttons, chimes, vibration and the offline queue work as they do now.
2. **Fix the missed check-in auto-SOS** (you chose "fire full SOS")
   - In check-missed-checkins, save the event as `trigger_type: "missed_checkin"`. The existing database trigger then starts the full send-sos-alert (WhatsApp, SMS, push, email, in-app).
   - Add a guard so each missed check-in creates only one SOS: skip if this user already has an active SOS from the last 60 minutes.
   - Redeploy the function and confirm it with a dry check of the logs.
3. Update the saved project notes (MMJ safety net) to say 30s instead of 60s.

## Technical details
- Files: `src/components/SOSDialog.tsx` (useState(10), setTimeLeft(10) x2, Progress calc), `src/hooks/useFallDetection.ts` (COUNTDOWN_SECONDS), `src/components/FallDetectionOverlay.tsx` (progress /15), `src/components/JourneyAutoSosOverlay.tsx` (COUNTDOWN_SEC), `supabase/functions/check-missed-checkins/index.ts` (~line 676).
- No database schema change is needed, because `missed_checkin` is already allowed.
