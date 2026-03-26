

# Fix Guardian Ping Reply Flow

## Current Problems

1. **RLS blocks replies**: The overlay inserts `{ user_id: guardian_id, guardian_user_id: user_id }` — swapping the IDs. But the RLS policy "Users can reply to guardian pings" requires `user_id = auth.uid()`. Since `user_id` is set to the guardian's ID (not the current user), the insert fails silently.

2. **Guardian never sees replies**: There's no UI on the Guardian Dashboard to view reply messages. Even if the insert worked, the guardian has no way to read them.

3. **No reply indicator in Messages page**: The Messages page only shows incoming pings, not the user's own replies.

## Solution

### Approach: Add a `reply_message` column to `guardian_pings`

Instead of creating a new row with swapped IDs (which breaks RLS), store the reply directly on the original ping row. The user already has UPDATE permission on their own pings (`user_id = auth.uid()`).

### Changes

**1. Database migration**
- Add `reply_message TEXT` and `replied_at TIMESTAMPTZ` columns to `guardian_pings`

**2. `GuardianPingOverlay.tsx`**
- Change `sendReply` from INSERT (new row) to UPDATE on the original ping:
  ```
  UPDATE guardian_pings SET reply_message = '...', replied_at = now() WHERE id = ping.id
  ```

**3. `GuardianDashboard.tsx`**
- Add a small "Sent Pings" section or badge that shows recent pings with replies
- Subscribe to realtime changes on `guardian_pings` to see replies as they arrive

**4. `Messages.tsx`**
- Show the user's own reply beneath each ping message (if `reply_message` exists)

### Files Modified

| File | Change |
|------|--------|
| Migration | Add `reply_message`, `replied_at` to `guardian_pings` |
| `src/components/GuardianPingOverlay.tsx` | UPDATE instead of INSERT for replies |
| `src/pages/GuardianDashboard.tsx` | Show sent pings with replies |
| `src/pages/Messages.tsx` | Display reply text under each ping |

