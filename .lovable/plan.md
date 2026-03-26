

# Add "Ping Guardian" Button to User Messages Page

## What Changes

Add a "Ping" button on the User's Messages page that opens a dialog (similar to the Guardian's ping dialog) letting the user send a message to their guardian with preset options and custom text input.

## How It Works

The existing `guardian_pings` table and RLS policies already support this — users can INSERT rows where `user_id = auth.uid()`, and guardians can SELECT rows where `guardian_user_id = auth.uid()`. So we insert a ping with the user as `user_id` and the guardian as `guardian_user_id`, and the guardian will see it in their Messages page.

## Technical Plan

### 1. Create `src/components/UserPingDialog.tsx`
- New dialog component similar to `GuardianPingDialog` but for the user role
- Fetch the user's guardians from the `guardians` table (accepted ones with `guardian_user_id`)
- If multiple guardians, show a selector; if one, auto-select
- Preset messages tailored for user-to-guardian: "I'm fine ✅", "Call me please 📞", "Need help", "Miss you ❤️", "Took my medicine 💊", "Feeling unwell 🤒"
- Custom message input + send button
- Insert into `guardian_pings` with `user_id = session.user.id`, `guardian_user_id = selectedGuardianId`

### 2. Update `src/pages/Messages.tsx`
- Add a floating or header "Ping Guardian" button that opens `UserPingDialog`
- Show sent pings from user in the messages list (fetch pings where `guardian_user_id` is in guardian list, showing both received and sent messages)

### 3. Update `src/pages/GuardianMessages.tsx`
- Ensure guardian sees user-initiated pings in their messages list (already works via existing query on `guardian_user_id = auth.uid()`)

| File | Change |
|------|--------|
| `src/components/UserPingDialog.tsx` | New — ping dialog for user to message guardian |
| `src/pages/Messages.tsx` | Add Ping button, show sent messages too |

