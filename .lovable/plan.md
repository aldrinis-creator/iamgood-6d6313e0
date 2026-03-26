

# Fix Guardian Call Button

## Problem

The Call button dropdown (Mobile Call / WhatsApp / Flash Call) silently does nothing because `wardPhone` is `null`. The `handleCallUser` function exits early at `if (!wardPhone) return;` with no feedback.

Two root causes:
1. The ward user likely hasn't saved a phone number in their profile, so `profiles.phone` is null
2. Even if the phone is missing, the UI gives zero feedback — the dropdown options just do nothing

## Changes

### 1. `src/pages/GuardianDashboard.tsx`
- Add a toast notification when `wardPhone` is null: "No phone number available for {wardName}. Ask them to add their phone in Profile settings."
- Disable the Call button visually (grey it out) when `wardPhone` is null, with a tooltip explaining why
- Add a fallback: also check the user's `auth.users` phone from `user_metadata` during profile fetch

### 2. `src/pages/MyProfile.tsx` (verify)
- Confirm that the phone field is saved to the `profiles` table so guardians can access it
- If phone is only in `user_metadata` but not synced to `profiles.phone`, add sync logic

| File | Change |
|------|--------|
| `src/pages/GuardianDashboard.tsx` | Toast when no phone, disable Call button when null |
| `src/pages/MyProfile.tsx` | Verify phone saves to profiles table |

