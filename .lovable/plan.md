

# Notification Center via Bell Icon in Header

## Problem
The bell icon in the header is currently a static button with a hardcoded red dot. It does nothing when tapped. Both **user** and **guardian** roles would benefit from seeing their notifications here — especially guardians who receive missed check-in alerts, SOS events, etc.

## Approach
Turn the bell icon into a **Sheet** (slide-in panel) that shows unread and recent notifications from the `notifications` table. For **users**, show notifications about them (`user_id = auth.uid()`). For **guardians**, show notifications linked to their guardian entries (already covered by existing RLS policies). Include mark-as-read and a badge count.

## Changes

### 1. New component: `src/components/NotificationCenter.tsx`
- Fetch notifications from `notifications` table (RLS handles user vs guardian filtering automatically)
- Show as a `Sheet` (side panel) triggered by the bell icon
- Display unread count badge on the bell
- Each notification shows title, message, timestamp, and a "Mark read" action
- "Mark all as read" button at top
- Realtime subscription for live updates
- Empty state when no notifications

### 2. Update `src/components/AppHeader.tsx`
- Replace the static bell `<button>` with the `NotificationCenter` component
- Remove the hardcoded red dot — the new component manages its own badge

### 3. Database: RLS policy for notifications INSERT (for users)
- Currently users can't INSERT notifications. For the notification center to work fully, no change needed — notifications are inserted by edge functions using service role key. The existing SELECT policies already allow both users and guardians to read their notifications.
- **UPDATE policy needed for users**: Currently only guardians can mark notifications as read. Add an UPDATE policy so users can also mark their own notifications as read (`user_id = auth.uid()`).

### Technical Notes
- Uses existing `Sheet` component from `src/components/ui/sheet.tsx`
- Realtime channel subscribes to `postgres_changes` on `notifications` table
- Badge shows unread count (capped at "9+")
- Notifications sorted by `created_at` descending, limited to 20

