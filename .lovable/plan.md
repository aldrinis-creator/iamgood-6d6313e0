## Plan — 4 Guardian-side fixes

### 1. Ambulance booking on Guardian Dashboard — match the User-app pattern

**Problem:** On the Guardian Dashboard quick-actions row, the "Ambulance" button renders `<AmbulanceBooking />` with **no props** (line 828 of `src/pages/GuardianDashboard.tsx`). With no `wardUserId/wardName/wardLocation/wardPhone`, the form falls into "patient = current logged-in user" mode (i.e. it tries to book for the Guardian themselves), which is wrong. `GuardianServices.tsx` already does this correctly.

**Fix:**
- In `GuardianDashboard.tsx`, pass the same props that `GuardianServices.tsx` passes:
  `wardUserId`, `wardName`, `wardLocation` (already loaded into state), and `wardPhone` (already loaded into state).
- Result: ambulance form opens pre-filled with the **ward's** name, phone, and last known location — identical behavior to the Services tab and to the User app booking flow.

No changes to `AmbulanceBooking.tsx` itself — it already supports both modes correctly.

---

### 2. Weekly Adherence chart shows wrong counts (e.g. "6 taken" on Friday)

**Problem in `src/components/WardMedicationAdherence.tsx`:**
- The component only counts logs with `status = "taken"` as taken (line 64), but `medication_logs` also stores `"taken_late"` for medications taken after the scheduled window. These are currently dropped silently — neither counted as taken nor missed.
- The "total" math (`Math.max(totalDailyDoses, taken + missed)`) uses the **current total daily doses** for **every day in the past 7 days**, even if the user's medication schedule was different a week ago. If a med was added today, past days get inflated totals.
- Date bucketing uses `scheduled_at?.slice(0, 10)` which is UTC date — for IST users near midnight this puts a dose into the wrong day. Per the project's IST core rule, this must use IST.
- "Today" can show inflated "taken" counts because `total` for today only counts doses already logged (taken + missed), so taking 6 of 6 morning doses shows 100% even if 4 evening doses are still pending.

**Fix:**
- Count both `"taken"` and `"taken_late"` as taken.
- For dates **before today**: `total = taken + missed + skipped` (only count what was actually logged historically — avoids retroactively counting newly-added meds).
- For **today**: `total = max(scheduled doses so far today, taken + missed)` — only count slots whose scheduled time has already passed, so progress is accurate during the day.
- Bucket all timestamps using IST (`Asia/Kolkata`) day boundaries.
- Recompute the 7-day average over only days that had scheduled doses.

---

### 3. "🗺️ Live" journey badge persists in Guardian app after the User has ended

**Problem:** `GuardianJourneyTracker` queries `journeys` for `status = "active"`. If the User closes the app or loses connectivity without calling `endJourney`, the row stays `active` indefinitely → the Guardian dashboard keeps showing a fake "Live" journey for hours/days.

**Fix (two complementary safeguards):**

a. **Client-side staleness guard in `GuardianJourneyTracker.tsx`:**
   - Fetch the latest `journey_updates.created_at` for the journey. If no GPS update for **>15 minutes**, treat as stale: hide the tracker (return `null`) and best-effort patch the row to `status = "abandoned"` so it stops showing for everyone.
   - Also stop showing if `started_at` is older than the journey's `estimated_duration_min + 60 min` buffer with no recent updates.

b. **Self-cleanup on the User side in `useJourneyTracker.ts` (already wired but verify):**
   - On hook mount, if there's an `active` journey whose last update is >15 min old, auto-end it with `status = "abandoned"` before subscribing to anything.
   - Confirm this runs on app reload so a User who opens the app again silently clears their own ghost journey.

Result: the Guardian dashboard no longer shows a permanently-stuck "Live" journey.

---

### 4. Guardian Location map shows even when User disabled location sharing

**Problem in `src/pages/GuardianDashboard.tsx` (lines 957–982):**

The map block reads `locationConsent` from `s?.shareLocationWithGuardian !== false` — meaning it only treats consent as **off** when the value is **explicitly `false`**. But:
- Older user accounts may not have `shareLocationWithGuardian` in their settings JSON yet → it's `undefined` → treated as consent **on** by default.
- More importantly, even when consent is off and the gate text shows ("…has not permitted their location to be displayed"), the **map is still rendered** in cases where `wardLocation` was loaded earlier (e.g. from an SOS event or a stale `lastLocation` in `user_settings`). The conditional ordering allows the map to leak.

There's also a separate setting `settings.shareLocation` (used by `useLocationSync` to decide whether to even **save** location) — if a User has `shareLocation = false`, no fresh location is saved, but the **last** `lastLocation` written before they turned it off remains in `user_settings.settings` forever and the Guardian map shows that stale dot.

**Fix:**

a. **Strict consent gate in `GuardianDashboard.tsx`:**
   - Treat `locationConsent = false` whenever `shareLocationWithGuardian === false` **OR** `shareLocation === false`.
   - When consent is off and there is no active SOS, render only the "not permitted" placeholder — never render `MapExpandable`, never call `handleRefreshLocation`, and don't expose lat/lng anywhere on the page. (SOS overrides consent, as it already does.)
   - Also clear the `wardLocation` state when consent flips off, so it doesn't reappear after a refresh of an SOS that was just resolved.

b. **Stop persisting stale location when sharing is disabled (`useLocationSync.ts`):**
   - When `settings.shareLocation` becomes `false`, in addition to skipping new writes, do a one-time upsert that removes `lastLocation` and `lastLocationAt` from the settings JSON. This prevents historical leakage on the Guardian side.

c. **Backend safety in `GuardianServices.tsx`:**
   - Pass `wardLocation` into `<AmbulanceBooking>` only if the ward's `shareLocationWithGuardian` consent is on (or there's an active emergency). For now, since Services lacks the active-SOS context, we'll gate purely on consent — Guardians can still type a pickup address manually for the ambulance when location is hidden.

---

### Files I will edit

- `src/pages/GuardianDashboard.tsx` — pass props to `<AmbulanceBooking />`; tighten location-consent rendering; clear `wardLocation` when consent off.
- `src/components/WardMedicationAdherence.tsx` — IST bucketing; `taken_late` counted; per-day "total" logic for past vs today.
- `src/components/GuardianJourneyTracker.tsx` — 15-min stale-update guard; mark stuck journeys `abandoned`.
- `src/hooks/useJourneyTracker.ts` — on-mount self-cleanup of own stale active journey.
- `src/hooks/useLocationSync.ts` — wipe stored `lastLocation` when `shareLocation` is turned off.
- `src/pages/GuardianServices.tsx` — read consent before passing `wardLocation` into ambulance booking.

### What I will NOT change

- No DB schema, RLS, or edge-function changes.
- No new tables (using existing `journeys.status` enum value `abandoned` if present, otherwise `auto_completed`).
- No changes to `AmbulanceBooking.tsx` internals.
- No changes to the User-side dashboard or User-app ambulance flow.

### Technical notes

- IST bucketing will use `toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })` to get a stable `YYYY-MM-DD` IST key, consistent with how other components in this project handle IST (per the standardization memory).
- The 15-minute stale threshold matches the User app's auto-end timer behaviour and the existing 5-min location-sync interval (so a single missed cycle doesn't false-trigger).
- All Supabase realtime subscriptions remain `filter`-scoped to `user_id` per the security rule.

Approve and I'll implement.