## Goal
Show a visible, audible popup on the Guardian's app when their Ward drifts **more than 1 km** away from any safe zone boundary, and a second popup when the Ward comes back inside a safe zone. This is on top of the existing zone-exit notification + WhatsApp alert — no changes to that behaviour.

## Behaviour

1. **Far-away alert (>1 km from the nearest safe zone edge)**
   - Fires only after the ward is already outside all safe zones (existing exit logic already flips `wasInsideRef` to false).
   - Triggered by the next `useLocationSync` tick where `min(haversine − zone.radius_m)` across all enabled zones is **> 1000 m**.
   - Fires once per "excursion" (reset when ward returns to any safe zone). A separate ref `farAlertSentRef` + `localStorage` flag `farFromSafeZoneAlerted` prevents repeats.
   - Suppressed while an active `journeys` row exists (same guard the exit alert already uses).

2. **Return alert**
   - Fires when the ward re-enters any safe zone AND the far-away alert had been sent for this excursion (so guardians only get the "back safe" popup if they were previously warned about the 1 km drift). This avoids noise for tiny in/out flickers at the zone boundary.
   - Clears both flags after firing.

3. **Delivery**
   - Insert a notification row per selected guardian into `public.notifications` with new `type` values:
     - `zone_far` — "🚨 [Ward] is more than 1 km from the '[Zone]' safe zone."
     - `zone_far_return` — "✅ [Ward] is back inside the '[Zone]' safe zone."
   - Uses the existing `insert_notifications_deduped` RPC — no schema change.
   - No WhatsApp/SMS in this feature (the existing exit/return WhatsApp templates already cover cross-channel).

4. **Guardian popup**
   - New component `src/components/GuardianSafeZoneOverlay.tsx`, modelled on `GuardianPingOverlay` and `GuardianMissedAlarmOverlay`.
   - Subscribes via Supabase Realtime to `notifications` inserts filtered by `user_id=eq.<guardian.id>` and reacts only to `type in ('zone_far','zone_far_return')`.
   - Renders a centered modal:
     - `zone_far`: red map-pin icon, title "Ward far from safe zone", body with ward name + zone name + approximate distance (km, from message payload), buttons **Call Ward** (tel:) and **Dismiss**.
     - `zone_far_return`: green check icon, title "Ward back in safe zone", single **Dismiss** button; auto-dismisses after 8 s.
   - Plays `playChime()` + vibration (200,100,200) on show. No looped alarm — this is an informational alert, not an SOS.
   - Mounted in `AppLayout.tsx` only for `role === "guardian" && !loginInProgress`.

5. **Settings toggle**
   - Add `guardianSafeZoneAlerts` (default `true`) to `useUserSettings` schema.
   - Toggle in `GuardianSettings.tsx` under the existing alerts section: "Safe-zone drift popups (>1 km)".
   - When off, `GuardianSafeZoneOverlay` early-returns before subscribing.

## Files touched

- `src/hooks/useLocationSync.ts` — add far-away detection + return branch; insert `zone_far` / `zone_far_return` notifications alongside the existing `zone_exit` / `zone_return` inserts. Stores distance in the message string. New `localStorage` key `farFromSafeZoneAlerted`.
- `src/components/GuardianSafeZoneOverlay.tsx` — new overlay component (Realtime subscription + modal UI).
- `src/components/AppLayout.tsx` — mount the overlay for guardians.
- `src/hooks/useUserSettings.ts` — add `guardianSafeZoneAlerts` field with default `true`.
- `src/pages/GuardianSettings.tsx` — add the toggle row.

## Notes / non-goals
- No changes to the existing `zone_exit`/`zone_return` alerts, WhatsApp templates, or the `msg91-whatsapp-safezone*` edge functions.
- Distance is computed against the nearest safe zone's edge (`haversine − radius_m`), not the centre, so the 1 km threshold matches the user's mental model.
- No new DB tables or migrations — reuses `notifications`.
