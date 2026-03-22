

# Add Push Notifications to SOS Alert Edge Function

## Overview
Add Web Push notification sending to the existing `send-sos-alert` edge function. When SOS is triggered, guardians will receive push notifications on their devices in addition to the existing email and in-app notifications.

## Changes

### `supabase/functions/send-sos-alert/index.ts`
- Copy the Web Push utilities (VAPID key import, JWT creation, `sendPushNotification`) from the existing `send-medication-push` function — these are proven working
- After the existing email-sending and DB notification logic, add a new section that:
  1. Reads `VAPID_PRIVATE_KEY` and the hardcoded `VAPID_PUBLIC_KEY`
  2. For each guardian, looks up their profile by `guardian_phone` in `profiles`, then queries `push_subscriptions` for that profile's `user_id`
  3. Sends a push notification with title "🚨 EMERGENCY SOS", body containing the user's name, tag `sos-alert`, and URL `/guardian`
  4. Cleans up expired subscriptions (410/404 responses)
- Push failures are logged but don't block the response — email + DB notifications still succeed independently
- Returns push send count alongside existing email results

### No other files change
The client-side `SOSDialog.tsx` already invokes `send-sos-alert` — no frontend changes needed.

## Technical Details
- Reuses the same VAPID public key: `BJq2e6gs1zTIdmNLo6v4DWL4trzwEedK_ghxuB9wb63nlh_y1ShYf2RS_IKdDdPu59tQJ3pLk5XHed6pGZ141lw`
- Same `VAPID_PRIVATE_KEY` secret already configured
- Guardian phone → profile ID lookup pattern matches `notify-guardian-medication` function
- Service worker `sw-push.js` already handles displaying push notifications with vibration and click-to-open

