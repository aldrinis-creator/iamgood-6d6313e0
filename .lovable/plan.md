## Plan — MMJ Safety Net (3 features)

Three additions to Map My Journey, all hooked into the existing `useJourneyTracker` lifecycle so they only run during an active journey.

---

### Feature 1: Low-Battery Guardian Alert (during journey)

**Trigger:** Active journey + battery ≤ 15% + not charging → fire **once per journey** to Guardians.

**Implementation:**

- In `useJourneyTracker.ts`, add a battery monitor effect that activates only when `activeJourney.status === "active"`.
- Uses `navigator.getBattery()` (already proven in `BatteryWarning.tsx`).
- On threshold cross, call `notifyGuardians("🔋 Battery Critical", "User's battery is at X% during journey to {destination}. Last known location attached.", "battery_critical")` and save a location update so Guardians see the latest pin.
- Ref flag `batteryAlertSentRef` prevents repeat fires; resets in `startJourney`/`endJourney`.
- No alert if user is charging (recovery in progress).

---

### Feature 2: Auto-SOS Escalation on Unanswered Deviation

**Trigger:** Route deviation active **AND** the journey check-in popup has been displayed for 5 minutes unanswered → start a **60-second pre-SOS countdown overlay** (cancellable). If not cancelled, fire the existing `triggerSOS()` from `AppContext`.

**Implementation:**

- In `useJourneyTracker.ts`: when `routeDeviation` becomes `true`, force `setShowCheckIn(true)` (the existing check-in popup) and start a 5-minute timer `deviationEscalationTimer`.
- If the user responds to the check-in OR `routeDeviation` clears OR journey ends → cancel timer.
- On timer expiry, set new state `pendingAutoSos = true`.
- New component `JourneyAutoSosOverlay.tsx` (mounted in `MapMyJourney.tsx`): full-screen 60-sec countdown matching the visual language of `FallDetectionOverlay`. "Cancel — I'm safe" button stops it; expiry calls `triggerSOS()` from `useApp()` and notifies Guardians with context: "Auto-SOS triggered: route deviation + no check-in response."
- The existing SOS pipeline (email/WhatsApp/push) handles delivery — no new backend.

**Safety guards:**

- Only escalates if `routeDeviation` is still active when timer fires (user back on route cancels).
- Audible chime + vibration during the 60-sec countdown so a conscious user definitely notices.
- One escalation per journey (ref flag).

---

### Feature 3: Public Shareable Live-Tracking Link

**Trigger:** User taps a new "Share live link via WhatsApp" button on the active journey panel in `MapMyJourney.tsx`.

**Database (new migration):**

- Table `journey_share_tokens`: `id, journey_id, user_id, token (unique, random 32-char), created_at, expires_at`. RLS: only owner can insert/select their own tokens.
- RPC `get_public_journey(_token text)` → SECURITY DEFINER, returns `{ destination_name, transport_mode, started_at, status, current_lat, current_lng, updated_at }` only when token matches an active journey. **No user identity, phone, health data, origin, or full breadcrumb trail exposed.** Returns null once `journeys.status != 'active'`.

**Frontend:**

- New public route `/j/:token` → component `PublicJourneyView.tsx`. Polls the RPC every 15 seconds, shows a Leaflet map with the moving dot, destination pin, ETA-style header ("User on the way to {destination}"), and a "Journey ended" state when status flips. No login, no header, no bottom nav (uses minimal layout).
- "Share live link via WhatsApp" button in `MapMyJourney.tsx` active-journey panel: creates a token, builds `https://iamgood.lovable.app/j/{token}`, opens `wa.me/?text={encoded message + link}`.
- Token is auto-invalidated when journey ends (RPC checks `journeys.status='active'` → returns null → public page shows "Journey has ended").

**Privacy:**

- Token is a one-shot per-journey secret — link only works while that journey is active.
- Public page intentionally shows zero PII: no name, no phone, no avatar, no health data.
- Optional: add a "Stop sharing" button that deletes the token immediately.

---

### Files touched

**Modified:**

- `src/hooks/useJourneyTracker.ts` — battery monitor, deviation-escalation timer, `pendingAutoSos` state, share-token helpers.
- `src/pages/MapMyJourney.tsx` — mount `JourneyAutoSosOverlay`, add "Share live link" button.

**New:**

- `src/components/JourneyAutoSosOverlay.tsx` — 60-sec countdown UI.
- `src/pages/PublicJourneyView.tsx` — public live-tracking page.
- Route entry in `src/App.tsx` for `/j/:token` (outside `AppLayout`, no auth).
- Migration: `journey_share_tokens` table + RLS + `get_public_journey` RPC.
- Memory file: `mem://features/mmj-safety-net`.

### What's deliberately NOT included

- **Signal-loss alert:** browser GPS `error` callbacks fire constantly on weak signal and would create alert spam. Battery is the better proxy for "phone died." Skip unless you specifically want it.
- **Persistent share links** (reusable across journeys): privacy risk. Per-journey only.
- **Showing the breadcrumb trail on the public page:** location history is more sensitive than current pin. Current dot only.

### Confirm before I proceed

1. Auto-SOS on unanswered deviation — keep the **60-second cancel countdown** before SOS fires? (Strongly recommend yes.)
2. Public share link — OK to expose `{destination_name, current_lat/lng, transport_mode}` and nothing else?
3. Build all three together, or sequence them (1 → 2 → 3)?  
Build all three together
  &nbsp;