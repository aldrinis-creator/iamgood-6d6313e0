

# Guardian Dashboard — Full Feature Build

This is a comprehensive overhaul of the Guardian experience covering 17 requirements. Due to scope, this will be implemented in phases.

## Phase 1: Nomination Flow & Consent (Items 1, 2)

### 1. Guardian Nomination with Accept/Reject
**Current state**: Guardian is auto-accepted. No invite sent.
**Change**:
- Set `status: "pending"` when User adds a guardian (Settings.tsx, Register.tsx)
- Update `send-guardian-invite` edge function to send WhatsApp link + email with Accept/Reject deep links
- Create new edge function `guardian-nomination-response` to handle accept/reject via token
- Add a `nomination_token` column to `guardians` table + `nomination_expires_at` (24h window)
- Auto-accept after 24h: check on guardian login via `link_guardian_user_id()` function
- On rejection: notify User via email/WhatsApp/in-app notification, set status to `"rejected"`

### 2. Location Consent Toggle
- Add `shareLocationWithGuardian` boolean to `user_settings`
- Add toggle in User's Settings → Privacy section
- Guardian dashboard checks this setting before showing location

## Phase 2: Guardian Dashboard Enhancements (Items 3-6, 10-12)

### 3. SOS/Fall Alerts with Timestamp + Emergency Health Card
- SOS/fall notifications already include `created_at` — display formatted date/time in alerts
- When SOS alert is shown, auto-expand the Emergency Health Card + Profile data (read-only)

### 4. Replace "Ward" with User's Name
- Replace all hardcoded "Ward" labels in `GuardianDashboard.tsx` and child components with `wardName`
- Update component props/titles: "Ward's Vitals" → "{name}'s Vitals"

### 5. Status Block: Timestamp + Refresh Button
- Add `lastActiveAt` timestamp (fetched from latest `check_ins` or `activity_logs` entry)
- Add date/time display below the status block
- Add a Refresh button that re-fetches all ward data on tap
- Replace hardcoded "78%", "2m ago", "4G" with real data where possible (last active from DB; battery/network are device-only, show "N/A" or remove)

### 6. Live Location Map (Consent-Gated)
- If User consented to location sharing: show embedded map (Google Maps static API or OpenStreetMap iframe) with last known coordinates from `activity_logs` or `sos_events`
- In SOS/Fall: show continuous location (poll every 30s from `sos_events` table)
- If consented but not SOS: show Refresh button to fetch current location on demand
- If not consented: display "User has not permitted their location to be displayed"

### 10. Auto-refresh Check-iNs
- Add realtime subscription on `check_ins` table filtered by `user_id = wardUserId`
- On INSERT/UPDATE, re-fetch today's check-ins automatically
- Show "Missed" label for overdue pending check-ins

### 11. Health Passport Auto-refresh
- Add realtime subscription for ward health data tables
- Re-compute `WardHealthPassport` on data changes

### 12. Keep existing displays as-is

## Phase 3: Communication Features (Items 7, 17)

### 7. Call User Options
- Replace single "Call User" button with a dropdown/dialog offering:
  - WhatsApp Call: `https://wa.me/{phone}`
  - Mobile Call: `tel:{phone}`
  - WhatsApp Video: WhatsApp doesn't support direct video call links from web — note this limitation; offer WhatsApp chat link instead

### 17. Ping User with Animated Messages
- Create `guardian_pings` table: `id, guardian_id, user_id, message, created_at, read`
- Guardian selects from preset phrases ("How are you?", "I Love You") or types custom text
- User receives an animated overlay/toast with the message
- User app subscribes to realtime on `guardian_pings` table

## Phase 4: Route & Ambulance (Items 8, 9)

### 8. Build Route
- "Route" button opens Google Maps directions: `https://www.google.com/maps/dir/?api=1&destination={wardLat},{wardLng}`
- Requires ward's last known location (from consent-gated location data)

### 9. Ambulance Booking with Health Data
- When Guardian books ambulance for User, auto-attach:
  - User's location (lat/lng)
  - Emergency Health Card data (blood group, allergies, conditions, meds)
  - User's profile (name, age, phone)
- Include this in the WhatsApp message sent to ambulance provider
- Keep existing Green/Red tab UI

## Phase 5: Reports & Alerts Tabs (Items 13, 15)

### 13. Build Alerts Tab
- New page `/guardian/alerts` showing all notifications grouped by type:
  - SOS alerts, Fall alerts, Missed check-ins, Medication missed/taken, Vitals anomalies
- Each alert shows timestamp, type badge, message, and dismiss action
- Filter by type, date range

### 15. Build Reports Tab
- New page `/guardian/reports` with sections:
  - **Medications**: List with dosage, timings, stock/refill status, Jan Aushadhi alternatives
  - **Medication Adherence Trendline**: 7/14/30-day taken vs missed chart (recharts)
  - **Check-in Trendline**: done/missed over time
  - **Activity Trend**: steps, exercise minutes over time
  - **Health Vitals Trend**: heart rate, BP, SpO2 over time
  - **Nutrition Trend**: calories, macros over time
- All data fetched from existing tables with guardian RLS policies

## Phase 6: Services & Appointments (Items 14, 16)

### 14. Guardian Can Make Appointments for User
- Add ability for guardian to insert into `appointments` table with `user_id = wardUserId`
- New RLS policy: guardians can INSERT appointments for their wards
- Add "Book Appointment" button in Guardian dashboard
- Reuse `AddAppointmentDialog` component with ward's user_id

### 16. Services Tab
- Add "Services" tab to guardian navigation
- Show limited services relevant to guardian: Ambulance booking, Medication ordering, Appointment booking
- Other services show "Register as a User to access this feature"

## Database Changes

| Change | Type |
|--------|------|
| Add `nomination_token`, `nomination_expires_at` to `guardians` | Migration |
| Create `guardian_pings` table | Migration |
| Add guardian INSERT policy on `appointments` | Migration |
| Add `shareLocationWithGuardian` default to user_settings | Code only |
| Update RLS on various tables to also match `guardian_user_id` | Migration |

## Route Changes (App.tsx)

| Route | Page |
|-------|------|
| `/guardian` | GuardianDashboard (My User tab) |
| `/guardian/alerts` | GuardianAlerts (new) |
| `/guardian/reports` | GuardianReports (new) |
| `/guardian/services` | GuardianServices (new) |
| `/guardian-settings` | Settings |

## Nav Tabs Update

Guardian tabs become: **My User**, **Alerts**, **Reports**, **Services**, **Settings** (5 tabs)

## Files Changed (estimated 15-20 files)

- `supabase/migrations/` — 1-2 new migrations
- `src/pages/GuardianDashboard.tsx` — major rewrite
- `src/pages/GuardianAlerts.tsx` — new
- `src/pages/GuardianReports.tsx` — new
- `src/pages/GuardianServices.tsx` — new
- `src/components/GuardianPingDialog.tsx` — new
- `src/components/NavTabs.tsx` — add Services tab
- `src/App.tsx` — add new routes
- `src/pages/Settings.tsx` — location consent toggle, nomination status "pending"
- `src/pages/Register.tsx` — nomination status "pending"
- `supabase/functions/send-guardian-invite/index.ts` — WhatsApp + email invite with accept/reject
- `supabase/functions/guardian-nomination-response/index.ts` — new
- `src/components/WardEmergencyCard.tsx` — replace "Ward" with name
- `src/components/WardVitalsSummary.tsx` — replace "Ward" with name
- `src/components/WardActivitySummary.tsx` — replace "Ward" with name
- `src/components/WardMedicationStatus.tsx` — replace "Ward" with name
- `src/components/WardHealthPassport.tsx` — replace "Ward" with name

## Implementation Order

1. Database migrations (nomination tokens, guardian_pings, RLS)
2. Nomination flow (invite + accept/reject + auto-accept)
3. Location consent + map display
4. Dashboard enhancements (timestamps, refresh, real data, rename Ward)
5. Communication (Call User options, Ping User)
6. Route + Ambulance with health data
7. Alerts page
8. Reports page with trendlines
9. Services tab + Guardian appointments
10. Realtime subscriptions for auto-refresh

