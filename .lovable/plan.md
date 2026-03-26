

# Move Guardian Sent Messages to Bottom Nav with Badge

## What Changes

Replace the "Services" tab in the guardian bottom nav bar with a "Messages" tab (since Services is already accessible from the top header nav).

## Technical Plan

### 1. Create `src/pages/GuardianMessages.tsx`
- Extract `SentPingsSection` logic from `GuardianDashboard.tsx` into a full page
- Full-page list of all sent pings with replies, ordered newest first
- Include unread reply count (pings where `reply_message IS NOT NULL` and a new `guardian_read` flag is false)
- Real-time subscription for incoming replies

### 2. Database migration
- Add `guardian_read BOOLEAN DEFAULT false` to `guardian_pings` — tracks whether the guardian has seen a reply

### 3. Update `src/components/NavTabs.tsx`
- Replace `{ icon: Stethoscope, label: "Services", path: "/guardian/services" }` with `{ icon: MessageCircle, label: "Messages", path: "/guardian/messages", badge: unreadReplies }`
- Add a realtime subscription counting pings where `reply_message IS NOT NULL AND guardian_read = false` for the badge bubble
- Import `MessageCircle` (already imported)

### 4. Update `src/App.tsx`
- Add route: `/guardian/messages` → `<GuardianRoute><GuardianMessages /></GuardianRoute>`

### 5. Update `src/components/AppHeader.tsx`
- Remove "Services" from the guardian header tabs (it stays in nav bar? No — reversed: Services stays in header, Messages moves to bottom nav). Keep Services in the header tabs as-is.

### 6. Clean up `src/pages/GuardianDashboard.tsx`
- Remove inline `SentPingsSection` component (now lives on its own page)
- Remove the `{wardUserId && <SentPingsSection ... />}` render

## Files Modified

| File | Change |
|------|--------|
| Migration | Add `guardian_read` column |
| `src/pages/GuardianMessages.tsx` | New page — sent pings list with reply tracking |
| `src/components/NavTabs.tsx` | Replace Services → Messages with badge |
| `src/App.tsx` | Add `/guardian/messages` route |
| `src/pages/GuardianDashboard.tsx` | Remove `SentPingsSection` |

