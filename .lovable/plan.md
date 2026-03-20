

# Fix Guardian Registration & Profile Management

## Problem
1. Registration Step 3 collects guardian details but does NOT require email (critical for emergency notifications via email)
2. Registration does NOT enforce at least 1 guardian with valid email before account creation
3. My Profile page only shows the primary guardian as read-only -- no way to add/manage up to 5 guardians
4. The GuardianTab component exists but is only used in Settings, not in My Profile

## Changes

### 1. Registration Step 3 (`src/pages/Register.tsx`)
- Add **guardian email** field (required for primary guardian) to the guardian form
- Add validation: primary guardian must have name, phone, AND email before submit
- Store `guardian_email` in the guardians insert

### 2. My Profile Guardians Section (`src/pages/MyProfile.tsx`)
- Replace the read-only "Primary Guardian" card with a full guardian management section
- Show all guardians (not just primary), with add/edit/delete capability
- Allow adding up to 5 guardians with name, phone, email, and relation
- Reuse patterns from `GuardianTab.tsx` (inline form, delete, primary badge)
- Include email field prominently since it's core to the notification USP

### 3. Guardian Tab Update (`src/components/GuardianTab.tsx`)
- Ensure the guardian add form also requires email for at least the primary guardian
- Keep as-is for Settings page usage

### Technical Details
- No database changes needed -- `guardians` table already has `guardian_email` column
- Registration guardian state changes from `{ name, phone, relation }` to `{ name, phone, email, relation }`
- MyProfile fetches ALL guardians (remove `is_primary` filter, remove `limit(1)`)
- Max 5 guardians enforced in both Registration and My Profile

