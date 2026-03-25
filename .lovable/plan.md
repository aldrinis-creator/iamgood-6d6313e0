

# Fix User-Guardian Workflow & Guardian Role Restrictions

## Problems Identified

After investigating the database and codebase, here are the root causes:

1. **Guardian role never saves correctly**: When someone registers as a "guardian", the database trigger `handle_new_user()` always sets `role: 'user'` in both `profiles` and `user_roles`. The Register page tries to update `profiles.role` afterward, but this fails silently because the `app_role` enum includes 'guardian' but the `user_roles` insert is hardcoded to 'user'. Both accounts currently show `role: user` in the database.

2. **Guardian can't find their ward**: The Guardian Dashboard matches wards by checking if the logged-in user's `profiles.phone` matches any `guardians.guardian_phone`. But the guardian's own phone number is `null` in their profile — the registration process stored it with a format like `+917045868482` but the DB shows null, likely because the profile update failed or the phone wasn't saved correctly during guardian registration.

3. **No nomination notification sent**: When a User adds a guardian, it's hardcoded to `status: "accepted"` with no email, SMS, or in-app notification sent to the nominated guardian. The FAQ describes an invitation flow that doesn't exist in code.

4. **SOS alerts don't reach the guardian app**: The SOS edge function creates a `notifications` row with `guardian_id`, but the guardian can't see it because the RLS policy on `notifications` requires matching `guardians.guardian_phone` against the guardian's `profiles.phone` — which is null.

5. **Guardian has full access to User features**: There's no route protection or feature gating. A guardian can navigate to `/dashboard`, `/my-health`, `/appointments`, `/medical-vault`, etc. and use everything a paying User can.

## Solution — Six Changes

### 1. Fix Guardian Role on Registration

**Files:** `supabase/migrations/` (new), `src/pages/Register.tsx`

- Update `handle_new_user()` trigger to accept the role from `raw_user_meta_data` so it correctly sets 'guardian' in both `profiles` and `user_roles` when someone registers as guardian.
- Update Register.tsx to pass the selected role in signup metadata so the trigger picks it up.
- Run a data fix to correct Don Carlos's profile: set `role: 'guardian'` in both `profiles` and `user_roles`, and ensure phone is saved.

### 2. Fix Guardian Phone Storage During Registration

**File:** `src/pages/Register.tsx`

The guardian registration flow calls `handleDetailsNext()` → `handleSubmit()` which updates `profiles.phone` with `${phoneCode}${phone}`. Verify this actually saves. The current guardian account has `phone: null` — this may be because the profile update runs before the profile row exists (race condition with the trigger). Add a retry/delay or use upsert to ensure the phone is saved.

### 3. Send Nomination Notification to Guardian

**Files:** `supabase/functions/` (new edge function `send-guardian-invite`), `src/pages/Register.tsx`, `src/pages/Settings.tsx`

When a User adds a guardian (during registration or in Settings):
- Send an email to the guardian's email address notifying them they've been nominated
- Include the User's name, relation, and a message explaining Check-iN
- Set initial status to `"pending"` instead of `"accepted"`
- Auto-accept after 24 hours (silent consent) via a scheduled check or on guardian's first login
- If the guardian is already registered, create an in-app notification too

### 4. Fix Notification Visibility for Guardians

**File:** Database RLS or notification query logic

The current RLS on `notifications` for guardians uses:
```
guardian_id IN (SELECT g.id FROM guardians g WHERE g.guardian_phone IN (SELECT p.phone FROM profiles p WHERE p.id = auth.uid()))
```
This requires the guardian's `profiles.phone` to match `guardians.guardian_phone`. An alternative approach: also match by `guardian_email` against the guardian's auth email, or link guardian records directly to the guardian's user ID via a `guardian_user_id` column.

Add a `guardian_user_id` column to the `guardians` table that stores the guardian's actual auth user ID (resolved from their email or phone). This makes all RLS queries simpler and more reliable than phone matching.

### 5. Restrict Guardian Access to User Features

**Files:** `src/components/ProtectedRoute.tsx`, `src/components/AppLayout.tsx`, `src/pages/` (multiple), `src/App.tsx`

- Create a `GuardianRoute` wrapper that only allows guardian-role users
- Create a `UserRoute` wrapper that only allows user-role users  
- Redirect guardians away from User-only pages (`/dashboard`, `/my-health`, `/appointments`, `/medical-vault`, `/subscription`) with a toast: "Register as a User to access this feature"
- Guardians can access: `/guardian` (dashboard), `/guardian-settings`, `/reports`, `/my-profile` (read-only), `/help`
- Update navigation (AppHeader, NavTabs) to never show User tabs to guardians

### 6. Redesign Guardian Navigation & Dashboard

**Files:** `src/components/NavTabs.tsx`, `src/components/AppHeader.tsx`, `src/pages/GuardianDashboard.tsx`

Guardian bottom tabs:
- **My User** (ward status, check-ins, alerts) — replaces "Dashboard"
- **Alerts** (SOS, missed check-ins, medication, vitals, falls)
- **Reports** (weekly summaries, care journal, health passport)
- **Settings** (notification preferences, profile)

Guardian features (read-only monitoring):
- SOS alerts with location
- Check-in status tracking
- Medication adherence (taken/missed/stock/refill)
- Daily Health Passport view
- Vitals report
- Care Journal
- Ambulance booking for ward
- Weekly status report
- Ward's read-only profile

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/` (new) | Fix `handle_new_user()`, add `guardian_user_id` to guardians, fix Don Carlos data |
| `src/pages/Register.tsx` | Pass role in metadata, fix phone save timing, send invite on guardian add |
| `src/pages/Settings.tsx` | Set status to "pending", send invite email on guardian add |
| `supabase/functions/send-guardian-invite/index.ts` | New edge function to email nomination invite |
| `src/components/ProtectedRoute.tsx` | Add role-based route guards |
| `src/App.tsx` | Apply UserRoute/GuardianRoute to appropriate pages |
| `src/components/AppHeader.tsx` | Update guardian nav tabs |
| `src/components/NavTabs.tsx` | Update guardian bottom tabs |
| `src/pages/GuardianDashboard.tsx` | Use `guardian_user_id` for ward lookup instead of phone matching |
| `src/components/NotificationCenter.tsx` | Update query to work with `guardian_user_id` |

## Implementation Order

1. Database migration (fix trigger + add guardian_user_id + data fix)
2. Fix registration flow (role + phone + invite)
3. Route guards (restrict guardian access)
4. Guardian navigation redesign
5. Notification/alert delivery fixes
6. Test end-to-end with both accounts

