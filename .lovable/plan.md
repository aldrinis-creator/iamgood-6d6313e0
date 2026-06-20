## Goal

When the Ward taps the green Call Guardian tab, the Guardian's Check-iN app should *actively ring* — loud, looping, attention-grabbing — regardless of whether the Guardian's browser tab is muted or in the background, **as long as the app is reachable** (foreground tab, background tab, or installed PWA with push enabled).

> Honest limit up front: if the Guardian's *phone* is in system Silent / DND / Focus mode, or the Check-iN app is fully uninstalled/closed with no push permission, nothing the web app does can force the phone hardware to ring. A real phone-style ring-through requires a native VoIP app (CallKit/ConnectionService). This plan gets us as close as possible inside the web/PWA.

## What changes

### 1. Backend — boost the existing call push (`notify-guardian-call`)
The edge function already sends a web push. Tweak its payload so the Guardian's service worker treats it as a *call*, not a normal notification:
- Add `kind: "incoming_call"`, `wardName`, `guardianId`, and a `callId` (uuid) to the JSON body.
- Keep `requireInteraction: true` and `tag` so the notification can't be silently coalesced.
- Also publish a Supabase Realtime broadcast on a per-guardian channel `guardian-call:{guardianUserId}` with the same payload, so a guardian who already has the app open gets the ring instantly without waiting for the push round-trip.

### 2. Guardian service worker (`src/sw.ts`)
Handle `kind: "incoming_call"`:
- Show the notification with `requireInteraction`, `renotify: true`, a custom vibration pattern, and an "Answer" / "Dismiss" action.
- On `notificationclick → Answer`, focus an existing client or open `/guardian?incoming_call={callId}` so the in-app ringer screen takes over.

### 3. New in-app ringer (Guardian side)
- New component `IncomingCallOverlay.tsx`: full-screen modal with Ward name, Answer (dials the Ward back via `tel:`) and Dismiss buttons, a pulsing avatar, and a looping ringtone.
- New hook `useIncomingCallListener.ts` mounted once in `GuardianDashboard` (and any other guardian-only route shell). It:
  - Subscribes to Realtime channel `guardian-call:{auth.uid()}`.
  - Also listens for `postMessage` from the service worker (for pushes received while a tab is open).
  - On signal, opens the overlay and starts the ringer.
- Ringer audio: bundle a short looping ringtone (`src/assets/ringtone.mp3`, ~3 s, loud). Play via `HTMLAudioElement` with `loop=true`, plus a Web Audio oscillator fallback (880 Hz pulses, reusing the existing distress-tone util) so a fresh tab that hasn't had a user gesture yet still produces sound the moment the user taps "Answer/Open" from the notification (the notification click counts as a user gesture).
- Auto-stop after 45 s if not answered; log a `missed_call` activity row.

### 4. Guardian-side opt-in awareness
- On the Guardian dashboard, add a one-line tip near the Alerts section: "Keep Check-iN open or installed and notifications on so Ward calls can ring you." Only show if push permission ≠ granted.
- No new settings, no new permissions beyond the existing push subscription.

### 5. Ward side
No change — the Ward already calls `notify-guardian-call` then dials `tel:`. Stays the same.

## Files touched

- `supabase/functions/notify-guardian-call/index.ts` — extend payload, add realtime broadcast.
- `src/sw.ts` — handle `incoming_call` push kind, postMessage to clients.
- `src/components/guardian/IncomingCallOverlay.tsx` *(new)*
- `src/hooks/useIncomingCallListener.ts` *(new)*
- `src/pages/GuardianDashboard.tsx` — mount listener + overlay.
- `src/assets/ringtone.mp3` *(new bundled asset)*
- `src/lib/audioAlerts.ts` — small helper to start/stop the call ringer (reuses existing audio infra).

## Verification

After build:
1. Sign in as Guardian on one browser, Ward on another.
2. Ward taps Call Guardian → Guardian's open tab shows the full-screen ringing overlay with looping tone within ~1 s.
3. Background the Guardian tab → push notification appears, clicking "Answer" focuses the tab and starts the ringer.
4. Revoke push permission for the Guardian → confirm only the open-tab realtime path still rings (no errors).

## Explicitly out of scope

- True phone ring-through that bypasses system Silent/DND (would need native CallKit/ConnectionService).
- WhatsApp / SMS fallback (you picked push + in-app ringer only).
- Two-way VoIP audio — the "Answer" button still uses `tel:` to place the actual call.
