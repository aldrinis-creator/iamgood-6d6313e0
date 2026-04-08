

## Comprehensive App Hardening: 5-Point Implementation Plan

### Summary

Five workstreams: (1) enforce freemium gating across remaining pages, (2) build a first-time onboarding wizard, (3) harden PWA for offline SOS, (4) polish guardian invitation flow, (5) make push notifications reliable when the app is backgrounded.

---

### 1. Enforce Freemium Gating Across the Full App

**Current state**: `useFeatureGate` and `UpgradeDialog` exist but are only wired into `MyHealth.tsx`. Guardian limits, journey geofencing, ambulance priority, and PDF exports are ungated.

**Changes**:

| File | Change |
|------|--------|
| `src/components/GuardianTab.tsx` | Before adding a guardian, check count: free users limited to 1, basic to 3, pro to 5. Show `UpgradeDialog` if at limit. |
| `src/pages/Settings.tsx` | Same guardian limit check in `addGuardian()`. |
| `src/pages/MapMyJourney.tsx` | Gate the geofence/alert radius feature behind Pro. Free/Basic users can track journeys but not set geofence alerts. |
| `src/components/AmbulanceBooking.tsx` | Add a "Priority" badge for Pro users. Free/Basic still get standard booking. |
| `src/lib/reportPdf.ts` | Gate `generatePdf()` calls: wrap in `canAccessFeature` check in callers (`DoctorVisitReport`, `ReportShareButtons`). |
| `src/lib/featureGating.ts` | Add entries: `"Guardian Limit"`, `"Geofencing"`, `"PDF Export"`. Add a `getGuardianLimit(plan)` helper returning 1/3/5. |

---

### 2. First-Time User Onboarding Wizard

**New file**: `src/components/OnboardingWizard.tsx`

A 4-step modal shown once after first login (tracked via `localStorage` key `onboarding_complete`):

1. **Welcome** — name greeting, app value prop
2. **Add Guardian** — inline form to add first guardian (pre-filled from registration if available)
3. **Set Check-In Times** — pick morning/afternoon/evening check-in schedule
4. **Emergency Profile** — prompt to fill blood type, allergies, emergency contact

Each step has skip/next. On completion, sets `localStorage` flag and navigates to dashboard.

**Integration**: Render `<OnboardingWizard />` in `src/pages/UserDashboard.tsx`, shown conditionally when flag is unset and user role is `"user"`.

---

### 3. Harden PWA for Offline SOS

**Goal**: SOS button works even without internet; queues the event and syncs when back online.

| File | Change |
|------|--------|
| `public/sw-push.js` | Add `sync` event listener for `"sos-sync"` tag. On sync, read queued SOS from IndexedDB and POST to Supabase. Add `fetch` event listener to cache the emergency profile page for offline access. |
| `src/contexts/AppContext.tsx` | In `triggerSOS()`, wrap the Supabase insert in a try/catch. On network failure, store SOS payload in IndexedDB and register a Background Sync (`navigator.serviceWorker.ready.then(r => r.sync.register("sos-sync"))`). |
| New: `src/lib/offlineQueue.ts` | IndexedDB helpers: `queueSOS(payload)`, `dequeueAllSOS()`, `isOffline()`. |
| `src/components/AppLayout.tsx` | Add a small offline indicator banner when `navigator.onLine === false`. |

---

### 4. Polish Guardian Invitation Flow

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Add "Re-send Invite" button next to pending guardians. Calls `send-guardian-invite` edge function again. Add real-time subscription on `guardians` table to update status badges (pending → accepted) without refresh. |
| `src/components/GuardianTab.tsx` | Same re-send + realtime subscription. Show `nominated_at` timestamp and "Expires in X hours" for pending invites. |
| `supabase/functions/send-guardian-invite/index.ts` | Add idempotency: skip if an invite was sent < 1 hour ago (check `nominated_at`). Return a clear message if rate-limited. |

---

### 5. Push Notification Reliability (CRITICAL)

**Problem**: Current medication/check-in reminders rely on in-app hooks (`useMedicationAlarms`, `useCheckInAudio`) that only fire when the app tab is active. The `send-medication-push` edge function exists but only matches exact hour times (e.g. `08:00`), missing schedules like `08:30`.

**Service Worker Enhancements** (`public/sw-push.js`):

- Add `notificationclose` event to track dismissed reminders
- Add action buttons to notifications: "Taken" and "Snooze 15 min"
- On "Taken" action click, POST to Supabase to mark the medication log as taken (using stored anon key + user token from IndexedDB)
- On "Snooze", schedule a local notification after 15 minutes using `setTimeout` within `waitUntil`

**Edge Function Fix** (`supabase/functions/send-medication-push/index.ts`):

- Remove the `currentMinute >= 2` early-return guard
- Instead, match medications where ANY `schedule_times` entry falls within the current cron window (±2 minutes of now), not just exact hour matches
- This makes 08:30, 14:45 etc. schedules work correctly

**New Edge Function**: `supabase/functions/send-checkin-push/index.ts`

- Mirrors `send-medication-push` but for check-in reminders
- Queries `check_ins` with `status = 'pending'` and `scheduled_at` within the next 5 minutes
- Sends push notification to the user's subscriptions
- Schedule via pg_cron every minute

**Push Payload Enhancement** (`send-medication-push` and `send-checkin-push`):

- Include `medication_id`, `log_id`, and `user_id` in the push data payload so the service worker can act on "Taken" clicks without opening the app
- Add `actions` field for notification action buttons

**Client-side** (`src/hooks/usePushSubscription.ts`):

- On subscribe, also store `user_id` and auth token in IndexedDB so the service worker can authenticate API calls for "Taken" actions

---

### Files Summary

| Action | File |
|--------|------|
| Modify | `src/lib/featureGating.ts` — add guardian limit helper, new feature keys |
| Modify | `src/components/GuardianTab.tsx` — guardian limit gating + realtime + re-send |
| Modify | `src/pages/Settings.tsx` — guardian limit gating + re-send + realtime |
| Modify | `src/pages/MapMyJourney.tsx` — gate geofencing |
| Modify | `src/components/AmbulanceBooking.tsx` — Pro priority badge |
| Modify | `src/components/health-tools/DoctorVisitReport.tsx` — gate PDF export |
| Create | `src/components/OnboardingWizard.tsx` — 4-step wizard |
| Modify | `src/pages/UserDashboard.tsx` — render onboarding wizard |
| Create | `src/lib/offlineQueue.ts` — IndexedDB SOS queue |
| Modify | `src/contexts/AppContext.tsx` — offline SOS fallback |
| Modify | `src/components/AppLayout.tsx` — offline indicator |
| Modify | `public/sw-push.js` — action buttons, sync handler, offline SOS |
| Modify | `supabase/functions/send-medication-push/index.ts` — fix time matching |
| Create | `supabase/functions/send-checkin-push/index.ts` — check-in push |
| Modify | `supabase/functions/send-guardian-invite/index.ts` — rate-limit re-sends |
| Modify | `src/hooks/usePushSubscription.ts` — store auth in IndexedDB |
| SQL | Schedule `send-checkin-push` via pg_cron every minute |

