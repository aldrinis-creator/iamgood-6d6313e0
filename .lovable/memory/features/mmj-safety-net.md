---
name: MMJ Safety Net
description: Three safety features layered on Map My Journey — low-battery guardian alert, auto-SOS escalation on unanswered route deviation, and public live-tracking share links.
type: feature
---

## Map My Journey — Safety Net (3 features)

All three features run only during an active journey, hooked into `useJourneyTracker.ts`.

### 1. Low-Battery Guardian Alert
- Uses `navigator.getBattery()`. When battery ≤ 15% AND not charging during an active journey, fires ONE notification to guardians (`type: "battery_critical"`) including last known location.
- Ref `batteryAlertSentRef` prevents repeats; resets on journey start/end.
- No alert if charging (recovery in progress).

### 2. Auto-SOS Escalation on Unanswered Deviation
- When `routeDeviation` becomes true: forces check-in popup open + starts 5-minute timer.
- If user responds OR returns to route → timer cancelled.
- If timer fires while still off-route AND check-in unanswered → sets `pendingAutoSos = true`, mounting `JourneyAutoSosOverlay`.
- Overlay shows 60-second cancel countdown (audible chime every 5s, vibration). On expiry: notifies guardians (`type: "auto_sos"`) + calls `triggerSOS()` from AppContext.
- One escalation per journey (`escalationFiredRef`).

### 3. Public Shareable Live-Tracking Link
- Table `journey_share_tokens` (RLS: owner-only). RPC `get_public_journey(_token)` is SECURITY DEFINER + grant to anon — returns ONLY `{destination_name, destination_lat/lng, transport_mode, started_at, status, current_lat/lng, updated_at}` while journey is `active`. No PII, no breadcrumb history.
- Tokens expire after 24h and auto-invalidate when journey ends (RPC checks `status='active'`).
- Share button in active-journey panel opens WhatsApp with `https://<origin>/j/<token>`.
- Public route `/j/:token` → `PublicJourneyView.tsx`, no auth, polls every 15s.

### Deliberately excluded
- GPS signal-loss alerts (too spammy on weak signal)
- Persistent share links across journeys (privacy risk)
- Breadcrumb trail on public page (current dot only)
