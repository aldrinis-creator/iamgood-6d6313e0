

## Fix Messaging Reply System

### Root Causes

1. **Overlay is the only reply mechanism** — Both `GuardianPingOverlay` and `UserPingOverlay` are ephemeral popups that appear on INSERT. Once dismissed, there's no way to reply to a message from either the Messages or GuardianMessages page.

2. **Messages pages don't subscribe to UPDATE events** — `Messages.tsx` subscribes only to `INSERT` events, so when a guardian replies to a user's ping (an UPDATE to the row), the user's Messages page doesn't refresh to show the reply. Similarly, `GuardianMessages.tsx` uses `event: "*"` which is fine.

3. **No inline reply on Messages pages** — Neither `Messages.tsx` nor `GuardianMessages.tsx` has a reply input for individual messages, so after the overlay is dismissed, users must send a fresh ping.

### Fixes

**A. `src/pages/Messages.tsx` — Add inline reply + subscribe to all events**
- Change realtime subscription from `event: "INSERT"` to `event: "*"` so replies (UPDATEs) trigger a refresh
- Add a reply input (Input + Send button) on each received ping card that doesn't already have a `reply_message`
- The reply updates `reply_message`, `replied_at`, and `read: true` on the ping row
- Also subscribe to pings where `guardian_user_id` matches known guardians to catch user-sent pings

**B. `src/pages/GuardianMessages.tsx` — Add inline reply for ward-sent pings**
- Currently shows only guardian-sent messages. Need to also fetch pings where the ward sent to this guardian (`user_id = ward, guardian_user_id = me` — these are already fetched)
- Add reply input on pings that don't have a `reply_message` yet (ward sent a ping, guardian can reply inline)
- The reply updates `reply_message`, `replied_at`, and `guardian_read: true`

**C. Both overlays — No changes needed** (they work for the instant popup; the fix is adding reply on the pages)

### Implementation Details

**Messages.tsx changes:**
- In `fetchPings`, also fetch pings where `guardian_user_id` is in the user's guardian list (user-sent pings) to show full conversation
- Mark direction properly: if the ping's `guardian_user_id` matches a known guardian AND the ping was inserted by the user (we can check this by seeing if the `user_id` matches the current user), show as "sent"
- Add per-card reply input with state tracking (`replyingTo` ID + `replyText`)
- Change realtime event from `"INSERT"` to `"*"`

**GuardianMessages.tsx changes:**
- Add per-card reply input for pings that don't have a reply yet
- Reply updates the existing ping row with `reply_message` and `replied_at`

### Files to modify
- `src/pages/Messages.tsx` — add inline reply, fix realtime subscription
- `src/pages/GuardianMessages.tsx` — add inline reply for ward-sent pings

