# Close the last 3 security warnings, then deep scan

## 1. Help assistant: earlier answers can't be faked
- The help chat will stop trusting "earlier assistant answers" sent from the phone. It will use only the person's own questions (last few, size-capped) when it writes a reply.
- What people see stays the same: the chat still shows the whole conversation.

## 2. Safe zone "returned" alert must be true
- Before sending the "returned to safe zone" WhatsApp, the backend checks the Ward's real last saved location against the saved safe zone (distance within the zone's radius).
- Ward name and zone name come from saved records, not from what the phone sends.
- Only the Ward themself (or an accepted guardian acting for them) can trigger it, and only to that Ward's accepted guardians (already enforced).
- A short cooldown stops repeat "returned" alerts for the same zone.

## 3. Bill scanning only on paid plans
- Bill scanning uses the same paid-plan check as other premium health tools (Premium, Premium Plus, Pro, admin).
- Free-plan users get a clear message with an upgrade prompt instead of a scan; typing amounts by hand still works for everyone.

## 4. Verify and scan
- Add small tests: paid-plan check for bill scanning; "inside zone" distance rule.
- Check, put the 3 updated backend functions live, test that signed-out calls are refused.
- Run the quick scan and a fresh deep scan, then report results.

## Technical details
- `product-assistant`: drop `assistant` role messages from client history (send only `user` turns, max ~6).
- `msg91-whatsapp-safezone-return`: take `zoneId` (+ optional `wardId`); load zone from `safe_zones`, last location from `user_settings.settings.lastLocation`, Haversine check, `canActForWard`; dedupe via notifications/recent-send record. Update the caller in `useLocationSync`/geofence code to send `zoneId`.
- `extract-bill`: look up active subscription and apply `premiumHealthPlan()` from `_shared/securityRules.ts`; return 403 `{code:"premium_required"}`; frontend shows upgrade toast.
- Mark the 3 findings fixed after deploy.
